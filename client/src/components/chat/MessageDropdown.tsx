'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { chatApi } from '@/lib/chatApi'
import { Conversation } from '@/types/chat'

interface MessageDropdownProps {
  onClose: () => void
  onMessagesRead: (conversationId: string) => void
}

export default function MessageDropdown({ onClose, onMessagesRead }: MessageDropdownProps) {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    // Get current user
    fetch('http://localhost:3001/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setCurrentUserId(data.id))
      .catch(() => {})

    // Get conversations
    chatApi.getConversations()
      .then(res => setConversations(res.data?.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false))

    // Listen for new messages from FAB to update unread counts in real-time
    function onNewMessage() {
      chatApi.getConversations()
        .then(res => setConversations(res.data?.conversations || []))
        .catch(() => {})
    }
    window.addEventListener('fab_message_sent', onNewMessage)
    return () => window.removeEventListener('fab_message_sent', onNewMessage)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleConversationClick = (conv: Conversation) => {
    // Dispatch read event so header badge clears
    window.dispatchEvent(new CustomEvent('messages_read', { detail: { conversationId: conv.id } }))
    onMessagesRead(conv.id)
    router.push(`/messages/${conv.id}`)
    onClose()
  }

  function avatarSrc(avatarUrl?: string | null, username?: string): string {
    if (avatarUrl) return avatarUrl
    if (username) return `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`
    return ''
  }

  function getOtherParticipant(conv: Conversation) {
    return conv.participants.find(p => p.userId !== currentUserId)?.user
  }

  function computeUnreadCount(conv: Conversation): number {
    // Backend provides accurate unreadCount per conversation
    return conv.unreadCount ?? 0
  }

  function formatTime(dateStr?: string): string {
    if (!dateStr) return ''
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

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-80 bg-surface-elevated border border-border rounded-xl shadow-xl overflow-hidden z-50"
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-bold text-text-primary">ข้อความ</h3>
        <Link
          href="/messages"
          onClick={onClose}
          className="text-xs text-primary hover:underline"
        >
          ดูทั้งหมด
        </Link>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="material-symbols-outlined text-text-muted animate-spin">progress_activity</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 px-6 text-center">
            <span className="material-symbols-outlined text-[#71767b]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48" }}>
              chat
            </span>
            <p className="text-sm text-[#71767b]">No conversations yet</p>
          </div>
        ) : (
          conversations.map(conv => {
            const other = getOtherParticipant(conv)
            const unread = computeUnreadCount(conv)

            return (
              <div
                key={conv.id}
                onClick={() => handleConversationClick(conv)}
                className={`px-4 py-3 border-b border-border hover:bg-black/10 cursor-pointer transition-colors ${
                  unread ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-surface-base">
                    {other?.avatarUrl || other?.username ? (
                      <img
                        src={avatarSrc(other?.avatarUrl, other?.username)}
                        alt={other?.displayName || other?.username || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-text-muted">
                        {(other?.displayName || other?.username)?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${unread ? 'font-bold text-text-primary' : 'text-text-primary'}`}>
                        {other?.displayName || other?.username || 'Unknown User'}
                      </p>
                      {conv.lastMessageAt && (
                        <p className="text-xs text-text-muted shrink-0">
                          {formatTime(conv.lastMessageAt)}
                        </p>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className={`text-xs truncate mt-0.5 ${unread ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                        {conv.lastMessage.content}
                      </p>
                    )}
                  </div>

                  {/* Unread badge */}
                  {unread > 0 && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                      <span className="text-xs font-bold text-white">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
