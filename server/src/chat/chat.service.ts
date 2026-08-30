import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getUserConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            mediaUrl: true,
            createdAt: true,
            senderId: true,
            sender: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const withUnread = await Promise.all(
      conversations.map(async (conv) => {
        const participant = conv.participants.find((p) => p.userId === userId);
        const lastReadAt = participant?.lastReadAt || new Date(0);

        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            createdAt: { gt: lastReadAt },
          },
        });

        return {
          ...conv,
          participants: conv.participants.map((p) => ({
            userId: p.userId,
            user: {
              id: p.user.id,
              username: p.user.username,
              displayName: p.user.displayName,
              avatarUrl: p.user.avatarUrl,
            },
            lastReadAt: p.userId === userId ? p.lastReadAt : null,
            joinedAt: p.joinedAt,
          })),
          lastMessage: conv.messages[0] || null,
          unreadCount,
        };
      }),
    );

    return {
      conversations: withUnread,
      nextCursor: null,
    };
  }

  async getOrCreate1to1(userId: string, otherUserId: string) {
    // Verify other user exists
    const otherUser = await this.prisma.user.findUnique({ where: { id: otherUserId } });
    if (!otherUser) throw new NotFoundException('User not found');

    const sortedPair = [userId, otherUserId].sort();
    const uniqueUserPair = sortedPair.join(':');

    let conversation = await this.prisma.conversation.findFirst({
      where: { uniqueUserPair: uniqueUserPair },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          uniqueUserPair,
          isGroup: false,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          participants: {
            create: [{ userId }, { userId: otherUserId }],
          },
        },
        include: {
          participants: {
            include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
          },
        },
      });
    } else {
      const existingParticipant = await this.prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: conversation.id, userId } },
      });
      if (!existingParticipant) {
        await this.prisma.conversationParticipant.create({
          data: { conversationId: conversation.id, userId },
        });
      }
      conversation = await this.prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: {
          participants: {
            include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
          },
        },
      });
    }

    return conversation;
  }

  async createGroupConversation(userId: string, participantIds: string[], name?: string) {
    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            { userId },
            ...participantIds.map((id) => ({ userId: id })),
          ],
        },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    return {
      ...conversation,
      participants: conversation.participants.map((p) => ({
        id: p.user.id,
        username: p.user.username,
        displayName: p.user.displayName,
        avatarUrl: p.user.avatarUrl,
      })),
    };
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    if (!conversation) throw new ForbiddenException('Conversation not found');

    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('Not a participant of this conversation');

    return {
      ...conversation,
      participants: conversation.participants.map((p) => ({
        userId: p.userId,
        user: {
          id: p.user.id,
          username: p.user.username,
          displayName: p.user.displayName,
          avatarUrl: p.user.avatarUrl,
        },
        lastReadAt: p.userId === userId ? p.lastReadAt : null,
        joinedAt: p.joinedAt,
      })),
    };
  }

  async getMessages(conversationId: string, userId: string, cursor?: string, limit?: number) {
    await this.getConversation(conversationId, userId);

    const take = Math.min(limit || 20, 100);
    let cursorDate: Date | undefined;

    if (cursor) {
      const cursorMsg = await this.prisma.message.findUnique({ where: { id: cursor } });
      if (!cursorMsg) throw new ForbiddenException('Cursor message not found');
      cursorDate = cursorMsg.createdAt;
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });

    const hasMore = messages.length > take;
    const results = hasMore ? messages.slice(0, take) : messages;
    const nextCursor = hasMore ? results[results.length - 1]?.id : null;

    return {
      messages: results.map((m) => ({
        id: m.id,
        conversationId,
        senderId: m.senderId,
        content: m.content,
        mediaUrl: m.mediaUrl,
        createdAt: m.createdAt,
        sender: m.sender,
        status: 'sent' as const,
      })),
      nextCursor,
    };
  }

  async sendMessage(conversationId: string, senderId: string, dto: SendMessageDto) {
    // Idempotency: return existing if clientId provided
    if (dto.clientId) {
      const existing = await this.prisma.message.findUnique({
        where: { clientId: dto.clientId },
        include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      });
      if (existing) return existing;
    }

    // Verify sender is participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant of this conversation');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          clientId: dto.clientId,
          conversationId,
          senderId,
          content: dto.content?.trim() ?? '',
          mediaUrl: dto.mediaUrl,
          expiresAt,
        },
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt, expiresAt },
      });

      // Create notification for other participants
      const participants = await tx.conversationParticipant.findMany({
        where: { conversationId, userId: { not: senderId } },
        select: { userId: true },
      });

      for (const p of participants) {
        await tx.notification.create({
          data: {
            type: 'MESSAGE',
            userId: p.userId,
            actorId: senderId,
            messageId: message.id,
            conversationId,
          },
        });
      }

      return message;
    });

    return result;
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
    return { success: true };
  }

  async getUnreadCount(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!participant) throw new ForbiddenException('Not a participant');

    const lastReadAt = participant.lastReadAt || new Date(0);

    const count = await this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        createdAt: { gt: lastReadAt },
      },
    });

    return { unreadCount: count };
  }
}
