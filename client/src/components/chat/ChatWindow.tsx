'use client'

import { useState, useRef, useCallback, KeyboardEvent } from 'react'
import type { Message, PendingMessage, ChatUser } from '@/types/chat'
import type { TypingUser } from '@/hooks/useChat'
import { getAvatarUrl } from '@/lib/avatarUtils'
import MessageList from './MessageList'

type ChatMessage = Message | PendingMessage

interface ChatWindowProps {
  messages: ChatMessage[]
  currentUserId: string
  otherUser?: { id: string; username: string; displayName?: string; avatarUrl?: string | null }
  onSendMessage: (content: string) => void
  onLoadMore?: () => void
  hasMore?: boolean
  loadingMore?: boolean
  typingUsers?: TypingUser[]
  onTypingStart?: () => void
  onTypingStop?: () => void
}

export default function ChatWindow({
  messages,
  currentUserId,
  otherUser,
  onSendMessage,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  typingUsers = [],
  onTypingStart,
  onTypingStop,
}: ChatWindowProps) {
  const [input, setInput] = useState('')
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Typing debounce ────────────────────────────────────────────────────────

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)

      if (!onTypingStart || !onTypingStop) return

      onTypingStart()

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStop()
      }, 2000)
    },
    [onTypingStart, onTypingStop]
  )

  // ── Send ────────────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return

    // Stop any pending typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    onTypingStop?.()

    onSendMessage(text)
    setInput('')
  }, [input, onSendMessage, onTypingStop])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // ── Avatar URL ─────────────────────────────────────────────────────────────

  const avatarUrl = otherUser
    ? getAvatarUrl(otherUser.avatarUrl ?? null, otherUser.username)
    : null

  const displayName = otherUser?.displayName || otherUser?.username || 'Chat'
  const username = otherUser?.username

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* ── Header ── */}
      <header className="sticky top-[64px] z-40 bg-black/80 backdrop-blur-md px-4 h-14 flex items-center gap-3 border-b border-[#2f3336]">
        {/* Back button */}
        <button
          onClick={() => history.back()}
          className="hover:bg-[#2f3336] p-2 rounded-full transition-colors"
          aria-label="Go back"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-white" aria-hidden="true">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2f3336] flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[#71767b]">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Name + username */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight">
            {displayName}
          </p>
          {username && (
            <p className="text-xs text-[#71767b] truncate leading-tight">
              @{username}
            </p>
          )}
        </div>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-1.5 animate-pulse">
            <div className="flex gap-0.5">
              <span
                className="w-1.5 h-1.5 bg-[#1d9bf0] rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-1.5 h-1.5 bg-[#1d9bf0] rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-1.5 h-1.5 bg-[#1d9bf0] rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
            <span className="text-xs text-[#1d9bf0]">
              {typingUsers[0].username}
              {typingUsers.length > 1 ? ` +${typingUsers.length - 1}` : ''} typing
            </span>
          </div>
        )}
      </header>

      {/* ── Message list ── */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        loadingMore={loadingMore}
        showAvatar={false}
      />

      {/* ── Input ── */}
      <div className="border-t border-[#2f3336] p-3">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className="
              flex-1 bg-[#2f3336] border border-[#2f3336]
              rounded-2xl px-4 py-2.5 text-white placeholder-[#71767b]
              resize-none focus:outline-none focus:border-[#1d9bf0] focus:ring-0
              custom-scrollbar text-sm
            "
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="
              w-10 h-10 rounded-full flex items-center justify-center
              shrink-0 transition-opacity
              disabled:opacity-30
              bg-[#1d9bf0] text-white hover:opacity-90
            "
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
