import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MediaIntegrityService {
  private readonly logger = new Logger(MediaIntegrityService.name);
  private readonly BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
  private readonly TIMEOUT_MS = 5000;

  constructor(private prisma: PrismaService) {}

  /**
   * Run every 6 hours.
   * Checks that active media URLs are still accessible.
   * Logs failed URLs for manual review — does NOT auto-delete to preserve data.
   */
  @Cron('0 */6 * * *')  // Every 6 hours at minute 0
  async checkMediaIntegrity(): Promise<{ checked: number; failed: number }> {
    this.logger.log('[MediaIntegrity] Starting health check...');

    // Check posts with media from the last 30 days (active content)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentPosts = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: thirtyDaysAgo },
        OR: [
          { mediaUrls: { isEmpty: false } },
          { video: { isNot: null } },
        ],
      },
      select: {
        id: true,
        mediaUrls: true,
        video: {
          select: {
            id: true,
            videoUrl: true,
            thumbnailUrl: true,
          },
        },
      },
    });

    let checked = 0;
    let failed = 0;
    const failedUrls: string[] = [];

    // Check each media URL
    for (const post of recentPosts) {
      // Check post images
      for (const url of post.mediaUrls) {
        checked++;
        const isOk = await this.checkUrl(url);
        if (!isOk) {
          failed++;
          failedUrls.push(url);
          this.logger.warn(`[MediaIntegrity] FAILED: ${url} (post ${post.id.slice(-8)})`);
        }
      }

      // Check video thumbnail
      if (post.video?.thumbnailUrl) {
        checked++;
        const isOk = await this.checkUrl(post.video.thumbnailUrl);
        if (!isOk) {
          failed++;
          failedUrls.push(post.video.thumbnailUrl);
          this.logger.warn(`[MediaIntegrity] FAILED: ${post.video.thumbnailUrl} (video ${post.video.id.slice(-8)})`);
        }
      }
    }

    // Also check user avatars and banners (last 7 days)
    const avatarUsers = await this.prisma.user.findMany({
      where: { updatedAt: { gte: thirtyDaysAgo } },
      select: { id: true, avatarUrl: true, bannerUrl: true },
    });

    for (const user of avatarUsers) {
      if (user.avatarUrl) {
        checked++;
        const isOk = await this.checkUrl(user.avatarUrl);
        if (!isOk) {
          failed++;
          failedUrls.push(user.avatarUrl);
          this.logger.warn(`[MediaIntegrity] FAILED avatar: ${user.avatarUrl} (user ${user.id.slice(-8)})`);
        }
      }
      if (user.bannerUrl) {
        checked++;
        const isOk = await this.checkUrl(user.bannerUrl);
        if (!isOk) {
          failed++;
          failedUrls.push(user.bannerUrl);
          this.logger.warn(`[MediaIntegrity] FAILED banner: ${user.bannerUrl} (user ${user.id.slice(-8)})`);
        }
      }
    }

    this.logger.log(
      `[MediaIntegrity] Done — checked: ${checked}, failed: ${failed}`,
    );

    if (failed > 0) {
      this.logger.warn(
        `[MediaIntegrity] Failed URLs: ${failedUrls.join(', ')}`,
      );
    }

    return { checked, failed };
  }

  /**
   * Check if a URL is accessible via HEAD request.
   * Returns true if URL returns 2xx/3xx, false otherwise.
   */
  private async checkUrl(url: string): Promise<boolean> {
    try {
      let fullUrl: string;

      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        if (urlObj.origin !== new URL(this.BASE_URL).origin) {
          return true; // External URL — skip check
        }
        fullUrl = url; // Self-hosted absolute URL
      } else {
        // Relative URL — construct full URL
        fullUrl = `${this.BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(fullUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok || response.status < 400;
    } catch {
      // Timeout, network error, etc. → treat as failed
      return false;
    }
  }
}
