import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatCleanupService } from './chat-cleanup.service';

@Injectable()
export class ChatCleanupTask {
  private readonly logger = new Logger(ChatCleanupTask.name);
  private isRunning = false;

  constructor(private cleanupService: ChatCleanupService) {}

  /**
   * Run every 5 minutes.
   * Uses isRunning flag to prevent overlapping executions.
   */
  @Cron('*/5 * * * *')  // Every 5 minutes
  async handleCron() {
    if (this.isRunning) {
      this.logger.warn('[ChatCleanupTask] Previous job still running, skipping this run');
      return;
    }

    this.isRunning = true;
    try {
      this.logger.log('[ChatCleanupTask] Starting cleanup job...');
      const result = await this.cleanupService.cleanupExpiredMessages();
      this.logger.log(
        `[ChatCleanupTask] Completed: ${result.deletedMessages} messages, ${result.deletedConversations} conversations deleted`,
      );
    } catch (error) {
      this.logger.error('[ChatCleanupTask] Cleanup job failed', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for testing.
   */
  async runNow() {
    return this.cleanupService.cleanupExpiredMessages();
  }
}