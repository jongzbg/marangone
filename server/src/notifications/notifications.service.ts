import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationType } from '@prisma/client'

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a notification
   */
  async create(data: {
    type: NotificationType
    userId: string   // recipient
    actorId: string  // sender
    postId?: string
    messageId?: string
    conversationId?: string
  }) {
    // Don't notify yourself
    if (data.userId === data.actorId) return null

    return this.prisma.notification.create({
      data: {
        type: data.type,
        userId: data.userId,
        actorId: data.actorId,
        postId: data.postId,
        messageId: data.messageId,
        conversationId: data.conversationId,
      },
      include: {
        actor: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        post: {
          select: { id: true, content: true },
        },
      },
    })
  }

  /**
   * Get notifications for a user (paginated)
   */
  async getNotifications(userId: string, cursor?: string, limit = 20) {
    console.log('[getNotifications] userId:', userId, 'cursor:', cursor);
    const take = Math.min(limit, 50)

    let cursorDate: Date | undefined
    if (cursor) {
      const cursorNotif = await this.prisma.notification.findUnique({ where: { id: cursor } })
      if (cursorNotif) cursorDate = cursorNotif.createdAt
    }

    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        type: { not: 'MESSAGE' },
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      include: {
        actor: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        post: {
          select: { id: true, content: true, userId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    })

    const hasMore = notifications.length > take
    const results = hasMore ? notifications.slice(0, take) : notifications
    const nextCursor = hasMore ? results[results.length - 1]?.id : null
    console.log('[getNotifications] Found', notifications.length, 'notifications, returning', results.length);
    console.log('[getNotifications] Types:', results.map(n => n.type));

    return {
      notifications: results,
      nextCursor,
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false, type: { not: 'MESSAGE' } },
    })
    return { unreadCount: count }
  }

  /**
   * Get unread MESSAGE notification count only
   */
  async getUnreadMessageCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false, type: 'MESSAGE' },
    })
    return { unreadMessageCount: count }
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId: string, notificationIds?: string[]) {
    if (notificationIds) {
      // Mark specific notifications as read
      await this.prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,  // Ensure ownership
        },
        data: { isRead: true },
      })
    } else {
      // Mark all non-MESSAGE notifications as read
      await this.prisma.notification.updateMany({
        where: { userId, isRead: false, type: { not: 'MESSAGE' } },
        data: { isRead: true },
      })
    }
    return { success: true }
  }

  /**
   * Mark one as read (when clicking a specific notification)
   */
  async markOneAsRead(notificationId: string, userId: string) {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    })
    return { success: true }
  }

  // ==================== Convenience methods for creating notifications ====================

  async notifyLike(userId: string, actorId: string, postId: string) {
    return this.create({ type: 'LIKE', userId, actorId, postId })
  }

  async notifyComment(userId: string, actorId: string, postId: string) {
    return this.create({ type: 'COMMENT', userId, actorId, postId })
  }

  async notifyRepost(userId: string, actorId: string, postId: string) {
    return this.create({ type: 'REPOST', userId, actorId, postId })
  }

  async notifyQuote(userId: string, actorId: string, postId: string) {
    return this.create({ type: 'QUOTE', userId, actorId, postId })
  }

  async notifyMessage(conversationId: string, userId: string, actorId: string, messageId: string) {
    return this.create({ type: 'MESSAGE', userId, actorId, messageId, conversationId })
  }

  async notifyFollow(userId: string, actorId: string) {
    return this.create({ type: 'FOLLOW', userId, actorId })
  }
}