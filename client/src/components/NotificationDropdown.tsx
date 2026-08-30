'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { notificationsApi } from '@/lib/notificationsApi'

interface NotificationActor {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

interface NotificationPost {
  id: string
  content: string
}

interface Notification {
  id: string
  type: 'LIKE' | 'COMMENT' | 'REPOST' | 'QUOTE' | 'MESSAGE' | 'FOLLOW'
  actor: NotificationActor
  post?: NotificationPost
  isRead: boolean
  createdAt: string
}

interface NotificationDropdownProps {
  onClose: () => void
  onMarkAllAsRead: () => void
  onMarkOneAsRead: () => void
}

export default function NotificationDropdown({ onClose, onMarkAllAsRead, onMarkOneAsRead }: NotificationDropdownProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    notificationsApi.getNotifications()
      .then(res => {
        setNotifications(res.data?.notifications || [])
        setHasMore(!!res.data?.nextCursor)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read (just this one)
    if (!notification.isRead) {
      await notificationsApi.markAsRead(notification.id)
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      )
      onMarkOneAsRead()
    }

    // Navigate
    switch (notification.type) {
      case 'LIKE':
      case 'COMMENT':
      case 'REPOST':
      case 'QUOTE':
        if (notification.post) {
          router.push(`/posts/${notification.post.id}`)
        }
        break
      case 'MESSAGE':
        // Handle message notification navigation if needed
        break
      case 'FOLLOW':
        router.push(`/profile/${notification.actor.username}`)
        break
    }

    onClose()
  }

  const loadMore = async () => {
    if (!hasMore || loadingMore || notifications.length === 0) return
    setLoadingMore(true)
    const lastNotif = notifications[notifications.length - 1]
    try {
      const res = await notificationsApi.getNotifications(lastNotif.id)
      const more = res.data?.notifications || []
      setNotifications(prev => [...prev, ...more])
      setHasMore(!!res.data?.nextCursor)
    } finally {
      setLoadingMore(false)
    }
  }

  const getNotificationText = (notification: Notification) => {
    const name = notification.actor.displayName || notification.actor.username
    switch (notification.type) {
      case 'LIKE': return `${name} ถูกใจโพสต์ของคุณ`
      case 'COMMENT': return `${name} ได้กล่าวถึงคุณในความเห็น`
      case 'REPOST': return `${name} แชร์โพสต์ของคุณ`
      case 'QUOTE': return `${name} อ้างอิงโพสต์ของคุณ`
      case 'FOLLOW': return `${name} เริ่มติดตามคุณ`
      case 'MESSAGE': return `${name} ส่งข้อความถึงคุณ`
      default: return 'การแจ้งเตือนใหม่'
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'LIKE': return 'favorite'
      case 'COMMENT': return 'chat_bubble'
      case 'REPOST': return 'repeat'
      case 'QUOTE': return 'format_quote'
      case 'MESSAGE': return 'mail'
      case 'FOLLOW': return 'person_add'
      default: return 'notifications'
    }
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-80 bg-surface-elevated border border-border rounded-xl shadow-xl overflow-hidden z-50"
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-bold text-text-primary">การแจ้งเตือน</h3>
        <button
          onClick={async () => {
            await notificationsApi.markAllAsRead()
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
            onMarkAllAsRead()
          }}
          className="text-xs text-primary hover:underline"
        >
          อ่านทั้งหมดแล้ว
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="material-symbols-outlined text-text-muted animate-spin">progress_activity</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            <span className="material-symbols-outlined text-3xl">notifications_off</span>
            <p className="mt-2 text-sm">ยังไม่มีการแจ้งเตือน</p>
          </div>
        ) : (
          <>
            {notifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`px-4 py-3 border-b border-border hover:bg-black/10 cursor-pointer transition-colors ${
                  !notification.isRead ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-base overflow-hidden flex-shrink-0">
                    {notification.actor.avatarUrl ? (
                      <img
                        src={notification.actor.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-text-muted">
                        {(notification.actor.displayName || notification.actor.username)?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-text-muted">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <p className="text-sm text-text-primary truncate">
                        {getNotificationText(notification)}
                      </p>
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                      )}
                    </div>
                    {notification.post && (
                      <p className="text-xs text-text-muted mt-1 truncate">
                        &ldquo;{notification.post.content}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-text-muted mt-1">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="p-3 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return date.toLocaleDateString()
}