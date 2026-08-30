import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { CountReconciliationService } from './count-reconciliation.service';
import { MediaIntegrityService } from './media-integrity.service';

/**
 * Temporary admin endpoints for SSOT maintenance tasks.
 * NOTE: These are development/testing only — protect with admin guard in production.
 */
@Controller('admin/maintenance')
export class MaintenanceController {
  constructor(
    private readonly reconcile: CountReconciliationService,
    private readonly media: MediaIntegrityService,
  ) {}

  /**
   * POST /admin/maintenance/reconcile
   * Trigger full count reconciliation (likes + reposts) manually.
   * Returns: { likesFixed: number, repostsFixed: number }
   */
  @Post('reconcile')
  async reconcileAll() {
    return this.reconcile.reconcileAll();
  }

  /**
   * POST /admin/maintenance/reconcile/repost
   * Trigger reposts count reconciliation only.
   * Returns: { repostsFixed: number }
   */
  @Post('reconcile/reposts')
  async reconcileReposts() {
    const fixed = await this.reconcile.reconcileReposts();
    return { repostsFixed: fixed };
  }

  /**
   * GET /admin/maintenance/reconcile/post/:id
   * Check and fix drift for a single post.
   * Returns: { postId, likesBefore, likesAfter, repostsBefore, repostsAfter }
   */
  @Get('reconcile/post/:id')
  async reconcilePost(@Param('id') postId: string) {
    return this.reconcile.reconcileSinglePost(postId);
  }

  /**
   * GET /admin/maintenance/media-check
   * Trigger media integrity health check manually.
   * Returns: { checked: number, failed: number }
   */
  @Get('media-check')
  async checkMedia() {
    return this.media.checkMediaIntegrity();
  }
}
