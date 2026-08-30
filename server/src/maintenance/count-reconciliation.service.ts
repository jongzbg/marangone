import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CountReconciliationService {
  private readonly logger = new Logger(CountReconciliationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Run every day at midnight.
   * Scans all posts and fixes any denormalized count drift.
   * Drift = Post.likesCount !== COUNT(Like) OR Post.repostsCount !== COUNT(Repost)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async reconcileAll(): Promise<{ likesFixed: number; repostsFixed: number }> {
    this.logger.log('[Reconciliation] Starting daily count reconciliation...');

    const likesResult = await this.reconcileLikes();
    const repostsResult = await this.reconcileReposts();

    this.logger.log(
      `[Reconciliation] Done — likes drifts fixed: ${likesResult}, reposts drifts fixed: ${repostsResult}`,
    );

    return { likesFixed: likesResult, repostsFixed: repostsResult };
  }

  /**
   * Fix likesCount drift: Post.likesCount !== COUNT(Like WHERE postId = Post.id)
   */
  async reconcileLikes(): Promise<number> {
    // Get all posts with their denormalized likesCount
    const posts = await this.prisma.post.findMany({
      select: { id: true, likesCount: true },
    });

    let fixed = 0;

    // Process in batches to avoid loading too many into memory
    const BATCH_SIZE = 100;
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);
      const postIds = batch.map((p) => p.id);

      // Bulk count actual likes per post
      const counts = await this.prisma.like.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { postId: true },
      });
      const countMap = new Map(counts.map((c) => [c.postId, c._count.postId]));

      for (const post of batch) {
        const actualCount = countMap.get(post.id) ?? 0;
        if (post.likesCount !== actualCount) {
          this.logger.warn(
            `[Reconciliation] Post ${post.id.slice(-8)}: likesCount=${post.likesCount} → actual=${actualCount}`,
          );
          await this.prisma.post.update({
            where: { id: post.id },
            data: { likesCount: actualCount },
          });
          fixed++;
        }
      }
    }

    return fixed;
  }

  /**
   * Fix repostsCount drift: Post.repostsCount !== COUNT(Repost WHERE postId = Post.id)
   */
  async reconcileReposts(): Promise<number> {
    const posts = await this.prisma.post.findMany({
      select: { id: true, repostsCount: true },
    });

    let fixed = 0;

    const BATCH_SIZE = 100;
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);
      const postIds = batch.map((p) => p.id);

      const counts = await this.prisma.repost.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { postId: true },
      });
      const countMap = new Map(counts.map((c) => [c.postId, c._count.postId]));

      for (const post of batch) {
        const actualCount = countMap.get(post.id) ?? 0;
        if (post.repostsCount !== actualCount) {
          this.logger.warn(
            `[Reconciliation] Post ${post.id.slice(-8)}: repostsCount=${post.repostsCount} → actual=${actualCount}`,
          );
          await this.prisma.post.update({
            where: { id: post.id },
            data: { repostsCount: actualCount },
          });
          fixed++;
        }
      }
    }

    return fixed;
  }

  /**
   * Manual trigger for testing a single post.
   * Call via: await countReconciliationService.reconcileSinglePost(postId)
   */
  async reconcileSinglePost(postId: string): Promise<{
    postId: string;
    likesBefore: number;
    likesAfter: number;
    repostsBefore: number;
    repostsAfter: number;
  }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { likesCount: true, repostsCount: true },
    });
    if (!post) throw new Error('Post not found');

    const [likesActual, repostsActual] = await Promise.all([
      this.prisma.like.count({ where: { postId } }),
      this.prisma.repost.count({ where: { postId } }),
    ]);

    const [, updated] = await Promise.all([
      post.likesCount !== likesActual
        ? this.prisma.post.update({
            where: { id: postId },
            data: { likesCount: likesActual },
          })
        : Promise.resolve(post),
      post.repostsCount !== repostsActual
        ? this.prisma.post.update({
            where: { id: postId },
            data: { repostsCount: repostsActual },
          })
        : Promise.resolve(post),
    ]);

    return {
      postId,
      likesBefore: post.likesCount,
      likesAfter: updated.likesCount,
      repostsBefore: post.repostsCount,
      repostsAfter: updated.repostsCount,
    };
  }
}
