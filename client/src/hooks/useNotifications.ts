'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { API_BASE_URL } from '@/lib/api'

interface Notification {
  id: string
  type: 'LIKE' | 'COMMENT' | 'REPOST' | 'QUOTE' | 'MESSAGE' | 'FOLLOW'
  actor: { id: string; username: string; displayName: string; avatarUrl: string }
  post?: { id: string; content: string }
  isRead: boolean
  createdAt: string
}

interface UseNotificationsOptions {
  onNewNotification?: (notification: Notification) => void
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const socketRef = useRef<Socket | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch unread count on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    fetch(`${API_BASE_URL}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setUnreadCount(data.unreadCount || 0))
      .catch(() => {})
  }, [])

  // Listen for new notifications
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const socket = io(`${API_BASE_URL}/notifications`, {
      auth: { token },
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      console.log('[NotificationsSocket] Connected:', socket.id)
    })

    socket.on('new_notification', (notification: Notification) => {
      setUnreadCount(prev => prev + 1)
      options.onNewNotification?.(notification)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [])

  const markAsRead = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/notifications/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      setUnreadCount(0)
    } catch (e) {
      console.error('Failed to mark notifications as read', e)
    }
  }, [])

  const decrementUnreadCount = useCallback(() => {
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      const data = await res.json()
      setUnreadCount(data.unreadCount || 0)
    } catch (e) {
      console.error('Failed to refresh unread count', e)
    }
  }, [])

  return {
    unreadCount,
    markAsRead,
    decrementUnreadCount,
    refreshUnreadCount,
  }
}