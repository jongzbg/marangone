'use client'

import type { Message, PendingMessage } from '@/types/chat'
import { getAvatarUrl } from '@/lib/avatarUtils'

type ChatMessage = Message | PendingMessage

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface MessageBubbleProps {
  message: ChatMessage
  isMine: boolean
  showAvatar: boolean
  showName?: boolean
  showTime?: boolean
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

export default function MessageBubble({
  message,
  isMine,
  showAvatar,
  showName = false,
  showTime = false,
}: MessageBubbleProps) {
  const isPending = 'status' in message && message.status === 'pending'
  const isError = 'status' in message && message.status === 'error'
  const sender = message.sender

  // ── Retry handler ─────────────────────────────────────────────────────────

  function handleRetry() {
    window.dispatchEvent(
      new CustomEvent('chat_retry_message', {
        detail: {
          clientId: 'clientId' in message ? message.clientId : '',
          content: message.content,
        },
      })
    )
  }

  // ── Avatar ────────────────────────────────────────────────────────────────

  function AvatarBlock() {
    if (!sender) {
      return <div className="w-8 flex-shrink-0" />
    }

    const avatarUrl = getAvatarUrl(sender.avatarUrl ?? null, sender.username)

    return (
      <div className="w-8 flex-shrink-0">
        <img
          src={avatarUrl}
          alt={sender.displayName || sender.username}
          className="w-8 h-8 rounded-full object-cover"
        />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''} group`}>
      {/* Avatar — only render when showAvatar is true AND not my message */}
      {!isMine && showAvatar && (
        <div className="w-8 flex-shrink-0">
          <AvatarBlock />
        </div>
      )}

      {/* Bubble column — time is NOT here, only bubble */}
      <div
        className="flex flex-col gap-0.5"
        style={{ width: 'fit-content', minWidth: 0 }}
      >
        {/* Sender name — shown when group has a gap */}
        {!isMine && showName && sender && (
          <span
            className="text-xs text-[#71767b] font-medium pl-1"
            style={{ lineHeight: 1 }}
          >
            {sender.displayName || sender.username}
          </span>
        )}

        {/* Bubble */}
        <div
          className={`
            px-3 py-2 rounded-2xl text-sm
            ${isMine
              ? 'bg-[#1d9bf0] text-white rounded-br-sm'
              : 'bg-zinc-800 text-white rounded-bl-sm'
            }
            ${isPending ? 'opacity-70' : ''}
            ${isError ? 'border border-red-500' : ''}
          `}
          style={{ overflowWrap: 'break-word' }}
        >
          <span>
            {(message.content || '').trimEnd()}
          </span>
        </div>
      </div>

      {/* Time + Retry — OUTSIDE bubble column, sibling, shown on hover */}
      {showTime && (
        <div
          className={`flex flex-col justify-end gap-0.5 pb-1 opacity-0 group-hover:opacity-100 transition-opacity ${
            isMine ? 'items-end' : 'items-start'
          }`}
        >
          <span className="text-xs text-text-muted whitespace-nowrap">
            {formatTime(message.createdAt)}
          </span>
          {isError && (
            <button
              onClick={handleRetry}
              className="text-red-500 text-xs hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
