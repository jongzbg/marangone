'use client'

import Link from 'next/link'
import { Conversation } from '@/types/chat'
import { timeAgo } from '@/lib/format'

interface ConversationListProps {
  conversations: Conversation[]
  onSelect?: (id: string) => void
  selectedId?: string
  currentUserId?: string
}

function avatarSrc(avatarUrl?: string | null, username?: string): string {
  if (avatarUrl) return avatarUrl
  if (username) return `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`
  return ''
}

export default function ConversationList({
  conversations,
  onSelect,
  selectedId,
  currentUserId,
}: ConversationListProps) {
  return (
    <div className="divide-y divide-[#2f3336]">
      {conversations.map((conv) => {
        const otherParticipant = conv.participants.find((p) => p.userId !== currentUserId)
        const user = otherParticipant?.user
        const unreadCount = conv.unreadCount ?? 0
        const isActive = selectedId === conv.id

        return (
          <div
            key={conv.id}
            className={`
              p-4 flex items-center gap-3 cursor-pointer transition-colors
              ${isActive ? 'bg-surface-base' : 'hover:bg-[#16181c]'}
            `}
            onClick={() => onSelect?.(conv.id)}
          >
            {/* Avatar — 48px */}
            <Link
              href={user ? `/profile/${user.username}` : '#'}
              className="shrink-0 w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={avatarSrc(user?.avatarUrl, user?.username)}
                alt={user?.displayName || user?.username || 'User'}
                className="w-full h-full object-cover"
              />
            </Link>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                {/* Name — bold if unread */}
                <p
                  className={`text-sm truncate ${
                    unreadCount > 0 ? 'font-bold text-text-primary' : 'font-normal text-text-primary'
                  }`}
                >
                  {user?.displayName || user?.username || 'Unknown User'}
                </p>

                {/* Time */}
                {conv.lastMessageAt && (
                  <p className="text-xs text-text-muted shrink-0">{timeAgo(conv.lastMessageAt)}</p>
                )}
              </div>

              {/* Message preview */}
              <p
                className={`text-sm truncate ${
                  unreadCount > 0 ? 'font-medium text-text-primary' : 'text-text-muted'
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
  )
}
