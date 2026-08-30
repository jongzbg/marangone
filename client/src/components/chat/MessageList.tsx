'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { Message, PendingMessage } from '@/types/chat'
import MessageBubble from './MessageBubble'

type ChatMessage = Message | PendingMessage

interface MessageListProps {
  messages: ChatMessage[]
  currentUserId: string
  onLoadMore?: () => void
  hasMore?: boolean
  loadingMore?: boolean
}

// ─── Date separators ──────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string, includeTime = false): string {
  const date = new Date(dateStr)
  const now = new Date()

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  let label: string
  if (date >= startOfToday) {
    label = 'Today'
  } else if (date >= startOfYesterday) {
    label = 'Yesterday'
  } else {
    label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (includeTime) {
    return `${label}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  return label
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

// ─── Consecutive message grouping ─────────────────────────────────────────────
// Two messages are grouped (no avatar repeat) when:
//   - Same sender AND
//   - Less than 2 minutes apart AND
//   - Not the first message in the list

function shouldShowAvatar(
  msgs: ChatMessage[],
  index: number
): boolean {
  const current = msgs[index]
  if (index === 0) return true

  const prev = msgs[index - 1]

  // Different sender → show avatar
  if (current.senderId !== prev.senderId) return true

  // Same sender but > 2 min gap → show avatar
  const gap = new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime()
  if (gap > 2 * 60 * 1000) return true

  return false
}

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ dateStr }: { dateStr: string }) {
  return (
    <div className="flex items-center gap-3 py-2 px-4">
      <div className="flex-1 h-px bg-[#2f3336]" />
      <span className="text-xs text-text-muted font-medium">{formatDateLabel(dateStr, true)}</span>
      <div className="flex-1 h-px bg-[#2f3336]" />
    </div>
  )
}

// ─── MessageList ──────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: ChatMessage[]
  currentUserId: string
  onLoadMore?: () => void
  hasMore?: boolean
  loadingMore?: boolean
  showAvatar?: boolean       // default: true
  className?: string         // for overriding container styles
}

export default function MessageList({
  messages,
  currentUserId,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  showAvatar = true,
  className = '',
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const isInitialMountRef = useRef(true)

  // Auto-scroll to bottom when messages change.
  // - Initial mount: always scroll to bottom (regardless of isAtBottomRef).
  // - After first scroll: only scroll if user is already at bottom.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const rafId = requestAnimationFrame(() => {
      if (!el) return

      if (isInitialMountRef.current) {
        // Initial mount: scroll to bottom immediately (no behavior delay)
        el.scrollTop = el.scrollHeight
        isInitialMountRef.current = false
      } else if (isAtBottomRef.current) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      }
    })
    return () => cancelAnimationFrame(rafId)
  }, [messages])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    // Track whether user is near the bottom
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottomRef.current = distFromBottom < 100

    // Infinite scroll: load older messages when near top
    if (onLoadMore && hasMore && !loadingMore && el.scrollTop < 50) {
      onLoadMore()
    }
  }, [onLoadMore, hasMore, loadingMore])

  // ── Build render list (with date separators & grouping) ──────────────────

  const renderItems: Array<{
    type: 'separator' | 'message'
    key: string
    data: string | ChatMessage
  }> = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = messages[i - 1]

    // Add date separator when day changes
    if (!prev || !isSameDay(msg.createdAt, prev.createdAt)) {
      renderItems.push({ type: 'separator', key: `sep-${msg.createdAt}`, data: msg.createdAt })
    }

    renderItems.push({ type: 'message', key: 'id' in msg ? msg.id : msg.clientId, data: msg })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar ${className}`}
    >
      {loadingMore && (
        <div className="flex justify-center py-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#71767b] animate-spin"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
        </div>
      )}

      {renderItems.map((item, idx) => {
        if (item.type === 'separator') {
          return <DateSeparator key={item.key} dateStr={item.data as string} />
        }

        const msg = item.data as ChatMessage
        const isMine = msg.senderId === currentUserId
        const shouldShowAvatarFlag = showAvatar && shouldShowAvatar(messages, messages.indexOf(msg))
        const prevItem = renderItems[idx - 1]
        // First message of the day — time is shown in DateSeparator, not in bubble
        const isFirstOfDay = !prevItem || prevItem.type === 'separator'
        const nextMsg = messages[messages.indexOf(msg) + 1]
        const isConsecutiveWithNext =
          nextMsg &&
          nextMsg.senderId === msg.senderId &&
          new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() <= 2 * 60 * 1000

        return (
          <div
            key={item.key}
            className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''} ${isConsecutiveWithNext ? 'mb-0.5' : ''}`}
          >
            <MessageBubble
              message={msg}
              isMine={isMine}
              showAvatar={shouldShowAvatarFlag}
              showTime={!isFirstOfDay}
            />
          </div>
        )
      })}

      {/* Typing indicator — injected via a separate mechanism, rendered below */}
      <div ref={bottomRef} />
    </div>
  )
}
