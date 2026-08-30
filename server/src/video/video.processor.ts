import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { VideoNotificationGateway } from './video-notification.gateway';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from 'fs';
import { join, extname } from 'path';

interface VideoJobData {
  videoId: string;
}

@Injectable()
export class VideoProcessor {
  private readonly logger = new Logger(VideoProcessor.name);
  private worker: Worker;
  private readonly TEMP_DIR = './storage/videos/temp';
  private readonly OUTPUT_DIR = './storage/videos/output';
  private readonly FFMPEG_TIMEOUT = 90000; // 90s
  private readonly FFMPEG_THREADS = 2;

  constructor(
    private prisma: PrismaService,
    private videoGateway: VideoNotificationGateway,
  ) {
    this.worker = new Worker(
      'video-processing',
      async (job: Job<VideoJobData>) => this.processJob(job),
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
        lockDuration: 60000,   // 60s — long enough for HD encoding
        lockRenewTime: 15000, // renew every 15s
        concurrency: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`✅ Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`❌ Job ${job?.id} failed: ${error.message}`);
      if (job) {
        this.prisma.video.update({
          where: { id: job.data.videoId },
          data: { status: 'failed', error: error.message },
        }).catch(() => {});
      }
    });

    this.logger.log('VideoProcessor worker started');
  }

  private async processJob(job: Job<VideoJobData>): Promise<void> {
    const { videoId } = job.data;
    const log = (msg: string) => this.logger.log(`[${videoId.slice(-8)}] ${msg}`);

    log('Job started — status: processing');
    console.log('[VideoProcessor] Job data:', JSON.stringify(job.data));
    console.log('[VideoProcessor] Process.cwd:', process.cwd());
    console.log('[VideoProcessor] TEMP_DIR:', this.TEMP_DIR);
    console.log('[VideoProcessor] OUTPUT_DIR:', this.OUTPUT_DIR);

    try {
      await this.prisma.video.update({
        where: { id: videoId },
        data: { status: 'processing' },
      });
    } catch { /* already updated */ }

    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      log('Video record not found — skipping');
      return;
    }

    const outputDir = join(this.OUTPUT_DIR, videoId);
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

    // Find temp file
    let tempFile = '';
    const filename = video.originalUrl?.split('/').pop() || '';
    if (filename) {
      const candidate = join(this.TEMP_DIR, filename);
      if (existsSync(candidate)) tempFile = candidate;
    }

    if (!tempFile || !existsSync(tempFile)) {
      log(`Temp file not found: ${tempFile || filename}`);
      await this.prisma.video.update({
        where: { id: videoId },
        data: { status: 'failed', error: 'Temp file not found' },
      });
      return;
    }

    const inputExt = extname(tempFile);
    let duration = 0;
    let thumbUrl: string | null = null;

    // ── 1. Probe duration ────────────────────────────────────────────────
    // Primary: parse from ffmpeg -i output
    // Fallback: parse from encode output (which also prints duration)
    const parseDurationFromOutput = (output: string): number => {
      // Try HH:MM:SS format (e.g. "Duration: 00:00:22")
      const m = output.match(/Duration:\s*(\d{1,2}):(\d{2}):(\d{2})/);
      if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
      // Try seconds float (e.g. "Duration: 22.5")
      const s = output.match(/Duration:\s*(\d+(?:\.\d+)?)/);
      if (s) return Math.floor(parseFloat(s[1]));
      return 0;
    };

    try {
      const probe = execSync(
        `ffmpeg -i "${tempFile}" 2>&1`,
        { encoding: 'utf-8', maxBuffer: 64 * 1024, timeout: this.FFMPEG_TIMEOUT },
      );
      duration = parseDurationFromOutput(probe);
      if (duration > 0) {
        log(`Duration from probe: ${duration}s`);
      } else {
        log(`Probe output did not contain parseable duration`);
      }
    } catch (e: any) {
      log(`Probe warning: ${e.message?.slice(0, 100)}`);
    }

    // ── 1b. Validate max duration (1 minute) ──────────────────────────────────
    const MAX_DURATION_SEC = 60;
    if (duration > MAX_DURATION_SEC) {
      log(`Video too long: ${duration}s (max ${MAX_DURATION_SEC}s) — marking failed`);
      await this.prisma.video.update({
        where: { id: videoId },
        data: { status: 'failed', error: `Video exceeds maximum duration of ${MAX_DURATION_SEC} seconds` },
      });
      // Cleanup temp file before exiting
      try { unlinkSync(tempFile); } catch {}
      return;
    }

    // ── 2. Generate thumbnail ─────────────────────────────────────────────
    const thumbPath = join(outputDir, 'thumb.jpg');
    try {
      const thumbCmd = `ffmpeg -i "${tempFile}" -ss 00:00:01 -vframes 1 -vf "scale=1920:-1" -q:v 2 "${thumbPath}" -y 2>&1`;
      execSync(thumbCmd, { stdio: 'pipe', timeout: 30000 });
      if (existsSync(thumbPath)) {
        thumbUrl = `/videos/${videoId}/thumb.jpg`;
        log(`Thumbnail generated`);
      }
    } catch (e: any) {
      log(`Thumbnail warning: ${e.message?.slice(0, 100)}`);
    }

    // ── Single resolution encode (480p) ─────────────────────────────────────
    const RESOLUTIONS = [
      { label: '480p', height: 480, crf: 24 },
    ];
    const successfulResolutions: string[] = [];

    for (const res of RESOLUTIONS) {
      const outFile = join(outputDir, `video_${res.label}.mp4`);
      try {
        // Skip if output already exists (idempotent — useful for retry)
        if (existsSync(outFile)) {
          log(`Skip ${res.label}: already exists`);
          successfulResolutions.push(res.label);
          continue;
        }

        // Only encode this resolution if the input is at least this tall
        // Parse input height from probe output
        const inputHeight = (() => {
          try {
            const probe = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "${tempFile}" 2>&1`, { encoding: 'utf-8', timeout: 15000 }).trim();
            return parseInt(probe) || 0;
          } catch { return 0; }
        })();

        if (inputHeight > 0 && inputHeight < res.height) {
          log(`Skip ${res.label}: input (${inputHeight}p) is smaller`);
          continue;
        }

        const encodeCmd = [
          'ffmpeg', '-i', `"${tempFile}"`,
          '-c:v', 'libx264',
          '-crf', String(res.crf),
          '-preset', 'fast',
          '-vf', `"scale=-2:${res.height}"`,
          '-threads', String(this.FFMPEG_THREADS),
          '-movflags', '+faststart',
          `"${outFile}"`, '-y',
        ].join(' ');

        log(`Encoding ${res.label} (crf ${res.crf})...`);
        execSync(encodeCmd, {
          stdio: 'pipe',
          timeout: this.FFMPEG_TIMEOUT,
          maxBuffer: 128 * 1024 * 1024,
        });

        if (existsSync(outFile)) {
          successfulResolutions.push(res.label);
          log(`${res.label} ✓ (${(require('fs').statSync(outFile).size / 1024 / 1024).toFixed(1)}MB)`);
        }
      } catch (e: any) {
        log(`${res.label} failed: ${e.message?.slice(0, 100)} — continuing`);
      }
    }

    // Fallback: if ALL resolutions failed, copy original
    if (successfulResolutions.length === 0) {
      const fallbackExt = inputExt || '.mp4';
      const fallbackOut = join(outputDir, `video_720${fallbackExt}`);
      try {
        copyFileSync(tempFile, fallbackOut);
        successfulResolutions.push('720p'); // mark as available (fallback)
        log('All encodes failed — using original as fallback');
      } catch (fallbackErr: any) {
        log(`Fallback failed: ${fallbackErr.message}`);
      }
    }

    // Determine final status
    const allLabels = RESOLUTIONS.map(r => r.label);
    const isComplete = allLabels.every(l => successfulResolutions.includes(l));
    const finalProfile: 'complete' | 'incomplete' | 'failed' =
      successfulResolutions.length === 0 ? 'failed' : isComplete ? 'complete' : 'incomplete';

    // videoUrl = highest quality available (legacy compatibility)
    const videoUrl = existsSync(join(outputDir, `video_720.mp4`))
      ? `/videos/${videoId}/video_720.mp4`
      : successfulResolutions.length > 0
        ? `/videos/${videoId}/video_${successfulResolutions[successfulResolutions.length - 1]}.mp4`
        : null;

    // ── 4. Update DB ─────────────────────────────────────────────────────
    await this.prisma.video.update({
      where: { id: videoId },
      data: {
        status: videoUrl ? 'ready' : 'failed',
        videoUrl,
        thumbnailUrl: thumbUrl,
        duration: duration || undefined,
        resolutions: successfulResolutions,
        encodingProfile: finalProfile,
        error: finalProfile === 'failed' ? 'All resolutions failed' : undefined,
      },
    });

    // ── 5. Cleanup temp file ─────────────────────────────────────────────
    try {
      unlinkSync(tempFile);
      log('Temp file cleaned up');
    } catch (e: any) {
      log(`Cleanup warning: ${e.message}`);
    }

    log(`Job complete — profile: ${finalProfile}, resolutions: [${successfulResolutions.join(', ')}]`);

    // ── 6. Notify connected clients ──────────────────────────────────────
    const updated = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (updated) {
      this.videoGateway.emitVideoReady(videoId, {
        status: updated.status as 'ready' | 'failed',
        videoUrl: updated.videoUrl ?? undefined,
        thumbnailUrl: updated.thumbnailUrl ?? undefined,
        resolutions: updated.resolutions ?? [],
        encodingProfile: updated.encodingProfile ?? undefined,
        error: updated.error ?? undefined,
      });
    }
  }
}