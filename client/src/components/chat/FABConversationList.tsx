'use client'

import { useEffect, useState, useCallback } from 'react'
import { timeAgo } from '@/lib/format'
import { getAvatarUrl } from '@/lib/avatarUtils'
import { chatApi } from '@/lib/chatApi'
import { useFABChat } from '@/hooks/useFABChat'
import type { Conversation } from '@/types/chat'

export default function FABConversationList() {
  const { openChat, setUnreadCount, closePanel } = useFABChat()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  // ── Fetch conversations ────────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const { data } = await chatApi.getConversations()
      const rawConvs: Conversation[] = (data as any)?.conversations || []
      // DEBUG: log unread counts per conversation
      rawConvs.forEach(c => console.log('[FABConvList] convId:', c.id, 'unreadCount:', c.unreadCount))
      setConversations(rawConvs)
      setUnreadCount(rawConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0))
    } catch {
      setConversations([])
    } finally {
      setLoading(false)
    }
  }, [setUnreadCount])

  useEffect(() => {
    let cancelled = false
    loadConversations().then(() => { if (cancelled) return })
    return () => { cancelled = true }
  }, [loadConversations])

  // ── Listen for new messages sent from FAB ─────────────────────────────────────
  // When a new message is sent from the FAB (confirmed by server), refresh
  // the conversation list so unread counts and lastMessage are up-to-date.

  useEffect(() => {
    function onNewMessage() {
      loadConversations()
    }
    window.addEventListener('fab_message_sent', onNewMessage)
    return () => window.removeEventListener('fab_message_sent', onNewMessage)
  }, [loadConversations])

  // ── Listen for when messages are read (from Header, dropdown, etc.) ───────────
  // This keeps FAB unread count in sync with the rest of the app.

  useEffect(() => {
    function onMessagesRead() {
      loadConversations()
    }
    window.addEventListener('messages_read', onMessagesRead)
    return () => window.removeEventListener('messages_read', onMessagesRead)
  }, [loadConversations])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header – always shown */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2f3336] shrink-0">
        <h2 className="text-base font-bold text-white">Chat</h2>
        <button
          onClick={closePanel}
          className="p-1.5 rounded-full hover:bg-[#2f3336] transition-colors text-[#71767b] hover:text-white"
          aria-label="Close panel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#71767b] animate-spin"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <span
              className="material-symbols-outlined text-[#71767b]"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48" }}
            >
              chat
            </span>
            <p className="text-sm text-[#71767b]">No conversations yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {conversations.map((conv) => {
              // Find the participant that represents the current user
              // (lastReadAt is only set for the current user by the backend)
              const currentParticipant = conv.participants.find((p) => p.lastReadAt !== null)
              const otherParticipant = conv.participants.find(
                (p) => p.userId !== currentParticipant?.userId
              )
              const user = otherParticipant?.user ?? conv.participants[0]?.user
              const unreadCount = (conv as any).unreadCount ?? (conv as any)._unreadCount ?? 0

              return (
                <div
                  key={conv.id}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#16181c] transition-colors border-b border-[#2f3336] last:border-b-0"
                  onClick={() => openChat(conv.id)}
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-[#2f3336] flex-shrink-0">
                    {user?.avatarUrl || user?.username ? (
                      <img
                        src={getAvatarUrl(user.avatarUrl ?? null, user.username)}
                        alt={user?.displayName || user?.username || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[#71767b]">
                        {(user?.displayName || user?.username || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-sm truncate ${
                          unreadCount > 0 ? 'font-bold text-white' : 'font-normal text-white'
                        }`}
                      >
                        {user?.displayName || user?.username || 'Unknown User'}
                      </p>

                      {conv.lastMessageAt && (
                        <p className="text-xs text-[#71767b] shrink-0">
                          {timeAgo(conv.lastMessageAt)}
                        </p>
                      )}
                    </div>

                    <p
                      className={`text-sm truncate ${
                        unreadCount > 0 ? 'font-medium text-white' : 'text-[#71767b]'
                      }`}
                    >
                      {conv.lastMessage?.content || 'No messages yet'}
                    </p>
                  </div>

                  {/* Unread badge */}
                  {unreadCount > 0 && (
                    <div className="w-5 h-5 rounded-full bg-[#1d9bf0] flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}