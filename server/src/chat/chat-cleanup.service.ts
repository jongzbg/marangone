import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatCleanupService {
  private readonly logger = new Logger(ChatCleanupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Cleanup expired messages and conversations.
   * Run every 5 minutes via @Cron decorator.
   * 
   * Order matters:
   * 1. Delete expired messages FIRST (Conversation has CASCADE delete for participants)
   * 2. Delete expired conversations
   */
  async cleanupExpiredMessages(): Promise<{ deletedMessages: number; deletedConversations: number }> {
    const now = new Date();

    // Step 1: Delete expired messages
    const expiredMessages = await this.prisma.message.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
    const deletedMessages = expiredMessages.count;
    this.logger.log(`[ChatCleanup] Deleted ${deletedMessages} expired messages`);

    // Step 2: Delete expired conversations
    // Note: When conversation is deleted, ConversationParticipant rows are cascade-deleted
    // Messages are also cascade-deleted (if any slipped through due to race conditions)
    const expiredConversations = await this.prisma.conversation.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
    const deletedConversations = expiredConversations.count;
    this.logger.log(`[ChatCleanup] Deleted ${deletedConversations} expired conversations`);

    return { deletedMessages, deletedConversations };
  }

  /**
   * Extend conversation expiry when there is activity.
   * Called after a message is sent.
   */
  async touchConversation(conversationId: string): Promise<void> {
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { expiresAt: newExpiry },
    });
  }
}