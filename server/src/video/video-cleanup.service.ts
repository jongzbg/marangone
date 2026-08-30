import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { existsSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class VideoCleanupService implements OnModuleInit {
  private readonly logger = new Logger(VideoCleanupService.name);
  private readonly queue: Queue;
  private worker: Worker;
  private readonly OUTPUT_DIR = './storage/videos/output';
  private readonly TEMP_DIR = './storage/videos/temp';
  private readonly TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

  constructor(private prisma: PrismaService) {
    this.queue = new Queue('video-cleanup', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    });

    this.worker = new Worker(
      'video-cleanup',
      async (job) => this.processJob(job),
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
        concurrency: 2,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`✅ Cleanup job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`❌ Cleanup job ${job?.id} failed: ${error.message}`);
    });
  }

  async onModuleInit() {
    this.logger.log('VideoCleanupService initialized');
    // Cleanup stale temp files on startup (non-blocking)
    this.cleanupTempFiles().catch((e) =>
      this.logger.error('[Init] Temp cleanup failed:', e.message),
    );
  }

  // ── Enqueue cleanup job with delay ─────────────────────────────────────────
  async enqueueCleanup(videoId: string): Promise<void> {
    await this.queue.add(
      'cleanup-video',
      { videoId },
      {
        jobId: `cleanup-${videoId}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        // Delay 5 minutes before cleanup (user might undo delete)
        delay: 5 * 60 * 1000,
      },
    );
    this.logger.log(`Cleanup job enqueued for video ${videoId.slice(-8)} (delay: 5min)`);
  }

  // ── Process cleanup job ────────────────────────────────────────────────────
  private async processJob(job: any): Promise<void> {
    const { videoId } = job.data;
    const log = (msg: string) =>
      this.logger.log(`[${videoId.slice(-8)}] ${msg}`);

    log('Cleanup started');

    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      log('Video record already gone — skipping');
      return;
    }

    // Only hard-delete if soft-deleted, otherwise skip
    if (!video.deletedAt) {
      log('Video not soft-deleted yet — skipping');
      return;
    }

    // Safety: don't delete a video that's currently being encoded
    if (video.status === 'processing') {
      log('Video is still processing — will retry cleanup on next attempt');
      // Re-enqueue with shorter delay (30s) to retry
      throw new Error('Video still processing — retry later');
    }

    const videoIdShort = videoId.slice(-8);

    // 1. Delete video output directory
    const outputDir = join(this.OUTPUT_DIR, videoId); // ← full videoId (matching processor)
    try {
      if (existsSync(outputDir)) {
        rmSync(outputDir, { recursive: true, force: true });
        log(`Deleted output dir: ${outputDir}`);
      }
      // Also try short-id fallback (in case of legacy dirs)
      const outputDirShort = join(this.OUTPUT_DIR, videoIdShort);
      if (existsSync(outputDirShort) && outputDirShort !== outputDir) {
        rmSync(outputDirShort, { recursive: true, force: true });
        log(`Deleted short-id output dir: ${outputDirShort}`);
      }
    } catch (e: any) {
      log(`Failed to delete output dir: ${e.message}`);
    }

    // 2. Delete original temp file (if any orphaned from /uploads/videos/temp/)
    try {
      const { readdirSync: ls } = require('fs');
      const tempFiles = ls(this.TEMP_DIR).filter((f: string) =>
        f.includes(videoIdShort) || f.includes(videoId.slice(0, 16)),
      );
      for (const f of tempFiles) {
        const fp = join(this.TEMP_DIR, f);
        try { rmSync(fp, { force: true }); log(`Deleted temp: ${f}`); } catch {}
      }
    } catch { /* temp dir might not exist */ }

    // 3. Hard-delete Video record from DB
    try {
      await this.prisma.video.delete({ where: { id: videoId } });
      log('Video record hard-deleted from DB');
    } catch (e: any) {
      log(`Failed to hard-delete video record: ${e.message}`);
    }

    log('Cleanup complete');
  }

  // ── Stale Processing Recovery: run every 10 minutes ──────────────────────
  // Problem: if BullMQ worker dies during encoding (e.g. Redis connection drops),
  // the job stays in "active" state forever → client polls forever.
  // Fix: reset any video stuck in "processing" for > 5 minutes to "failed",
  // then re-enqueue for retry.
  @Cron('*/10 * * * *')  // Every 10 minutes
  async recoverStaleProcessing(): Promise<void> {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    const staleVideos = await this.prisma.video.findMany({
      where: {
        status: 'processing',
        updatedAt: { lt: staleThreshold },
      },
      select: { id: true },
    });

    if (staleVideos.length === 0) return;

    this.logger.warn(`[Recovery] Found ${staleVideos.length} stale processing videos`);

    for (const video of staleVideos) {
      this.logger.warn(`[Recovery] Resetting stale video ${video.id.slice(-8)} to failed`);

      await this.prisma.video.update({
        where: { id: video.id },
        data: {
          status: 'failed',
          error: 'Processing timeout — auto-reset by recovery cron',
        },
      });

      // Re-enqueue for retry (skip if already completed/failed by now)
      await this.enqueueRecoveryJob(video.id);
    }
  }

  // ── Enqueue a single video for re-processing ──────────────────────────
  private async enqueueRecoveryJob(videoId: string): Promise<void> {
    try {
      const { Queue } = require('bullmq');
      const recoveryQueue = new Queue('video-processing', {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
      });
      await recoveryQueue.add('process-video', { videoId });
      await recoveryQueue.close();
      this.logger.log(`[Recovery] Re-enqueued video ${videoId.slice(-8)} for reprocessing`);
    } catch (e: any) {
      this.logger.error(`[Recovery] Failed to re-enqueue video ${videoId.slice(-8)}: ${e.message}`);
    }
  }

  async cleanupTempFiles(): Promise<void> {
    if (!existsSync(this.TEMP_DIR)) return;

    const now = Date.now();
    let deletedCount = 0;
    let errorCount = 0;

    try {
      const files = readdirSync(this.TEMP_DIR);
      for (const file of files) {
        const filePath = join(this.TEMP_DIR, file);
        try {
          const { existsSync: fsExists, statSync } = require('fs');
          if (!fsExists(filePath)) continue;
          const stat = statSync(filePath);
          if (now - stat.mtimeMs > this.TEMP_MAX_AGE_MS) {
            rmSync(filePath, { force: true });
            deletedCount++;
          }
        } catch (e: any) {
          errorCount++;
          this.logger.warn(`[TempCleanup] Failed to process ${file}: ${e.message}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`[TempCleanup] Failed to read temp dir: ${e.message}`);
    }

    this.logger.log(
      `[TempCleanup] Done — deleted: ${deletedCount}, errors: ${errorCount}`,
    );
  }
}