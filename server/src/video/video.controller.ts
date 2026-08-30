import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideoController {
  constructor(private videoService: VideoService) {}

  // GET /videos/post/:postId/status  (must be before :id routes to avoid conflict)
  @Get('post/:postId/status')
  async getStatusByPost(@Param('postId') postId: string) {
    return this.videoService.getStatusByPost(postId);
  }

  // GET /videos/:id/stream — SSE fallback for real-time video status updates
  // NOTE: intentionally public (no JWT) — EventSource can't send auth headers
  @Get(':id/stream')
  async streamVideoStatus(
    @Param('id') videoId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const check = async () => {
      try {
        const video = await this.videoService.getStatus(videoId);
        if (!video) {
          send('error', { message: 'Video not found' });
          res.end();
          return;
        }
        send('video_update', video);
        if (video.status === 'ready' || video.status === 'failed') {
          res.end();
          return;
        }
      } catch {
        send('error', { message: 'Internal error' });
        res.end();
        return;
      }
      setTimeout(check, 2000);
    };

    check();
    req.on('close', () => res.end());
  }

  // GET /videos/:id/status
  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    return this.videoService.getStatus(id);
  }
}