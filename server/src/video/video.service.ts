import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly queue: Queue;

  constructor(private prisma: PrismaService) {
    this.queue = new Queue('video-processing', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    });
    console.log('[VideoService] Queue created, REDIS_HOST:', process.env.REDIS_HOST, 'REDIS_PORT:', process.env.REDIS_PORT);
  }

  // ── Register a temp upload, enqueue BullMQ job ───────────────────────────
  async registerUpload(tempFilePath: string, filename: string): Promise<string> {
    const video = await this.prisma.video.create({
      data: {
        postId: null,
        originalUrl: `/videos/temp/${filename}`,
        status: 'pending',
        tempId: `temp:${Date.now()}`,
      },
    });
    console.log('[VideoService] Video record created:', video.id, 'status:', video.status);

    // Enqueue BullMQ job
    const job = await this.queue.add(
      'process-video',
      { videoId: video.id },
      {
        jobId: video.id,
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );
    console.log('[VideoService] Job enqueued:', job.id, 'videoId:', video.id);

    return video.id;
  }

  // ── Update video.postId when Post is created ─────────────────────────────
  async linkToPost(videoId: string, postId: string): Promise<void> {
    await this.prisma.video.update({
      where: { id: videoId },
      data: { postId },
    });
  }

  // ── Query ───────────────────────────────────────────────────────────────
  async getStatus(videoId: string) {
    return this.prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        status: true,
        videoUrl: true,
        thumbnailUrl: true,
        duration: true,
        error: true,
        resolutions: true,
        encodingProfile: true,
      },
    });
  }

  async getStatusByPost(postId: string) {
    const video = await this.prisma.video.findFirst({ where: { postId } });
    if (!video) return null;
    return this.getStatus(video.id);
  }

  // ── Soft delete ────────────────────────────────────────────────────────
  async softDelete(postId: string) {
    const video = await this.prisma.video.findFirst({ where: { postId } });
    if (!video) return;
    await this.prisma.video.update({
      where: { id: video.id },
      data: { deletedAt: new Date() },
    });
  }
}
