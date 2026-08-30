'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { userApi } from '@/lib/api'

interface UserHoverCardProps {
  /** Username to display */
  username: string
  /** Trigger rect from getBoundingClientRect() */
  rect: DOMRect
  /** Left edge of card (absolute page position) */
  left: number
  /** Which side to show */
  placement: 'top' | 'bottom'
  /** Username ของคนที่ login — ใช้เทียบ "is own profile" */
  currentUsername: string | null
  /** Callback: เรียกเมื่อ hover enter trigger */
  onHoverEnter: (username: string, rect: DOMRect, left: number, placement: 'top' | 'bottom') => void
  /** Callback: เรียกเมื่อ hover leave trigger */
  onHoverLeave: () => void
  /** Callback: เรียกเมื่อ hover enter card */
  onCardEnter: () => void
  /** Callback: เรียกเมื่อ hover leave card */
  onCardLeave: () => void
  /** Callback: อัพเดท data กลับไปยัง hook */
  onDataUpdate: (data: HoverCardUserData) => void
}

export interface HoverCardUserData {
  userId: string
  username: string
  avatar: string
  name: string
  bio: string
  following: number
  followers: number
  likes: number
  likesToday?: number
  isFollowing?: boolean
}

// Determine if card should open above or below the trigger
function getPlacement(rect: DOMRect): 'top' | 'bottom' {
  const viewportHeight = window.innerHeight
  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top
  // Card height ~180px — if less than that below, open above
  return spaceBelow < 220 ? 'top' : 'bottom'
}

// Position: prefer showing below trigger, align left edge
function getCardStyle(rect: DOMRect, placement: 'top' | 'bottom'): React.CSSProperties {
  const CARD_WIDTH = 320
  let top: number
  if (placement === 'bottom') {
    top = rect.bottom + 8
  } else {
    top = rect.top - 8
  }

  // Clamp so card doesn't overflow viewport edges
  let left = rect.left
  // Keep card within viewport width
  if (left + CARD_WIDTH > window.innerWidth - 16) {
    left = window.innerWidth - CARD_WIDTH - 16
  }
  if (left < 16) left = 16

  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${CARD_WIDTH}px`,
    zIndex: 9999,
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export default function UserHoverCard({
  username,
  rect,
  left,
  placement,
  currentUsername,
  onHoverEnter,
  onHoverLeave,
  onCardEnter,
  onCardLeave,
  onDataUpdate,
}: UserHoverCardProps) {
  const isOwnProfile = currentUsername === username
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    userApi.getProfile(username).then((res) => {
      const p = res.data
      onDataUpdate({
        userId: p.id,
        username: p.username,
        avatar: p.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${p.username}`,
        name: p.displayName || p.username,
        bio: p.bio || '',
        following: p.followingCount || 0,
        followers: p.followersCount || 0,
        likes: p.likesCount || 0,
        likesToday: p.likesTodayCount,
        isFollowing: p.isFollowing,
      })
    }).catch(() => {
      hasFetched.current = false
    })
  }, [username, onDataUpdate])

  const dynamicPlacement = getPlacement(rect)
  const style = getCardStyle(rect, dynamicPlacement)

  return (
    <div
      style={style}
      className="bg-surface-elevated border border-border rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150"
      onMouseEnter={onCardEnter}
      onMouseLeave={onCardLeave}
    >
      {/* Header row */}
      <div className="flex justify-between items-start gap-3">
        <Link
          href={`/profile/${username}`}
          className="shrink-0 w-14 h-14 rounded-full overflow-hidden hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            alt={username}
            className="w-full h-full object-cover"
            src={`https://api.dicebear.com/7.x/identicon/svg?seed=${username}`}
          />
        </Link>

        {!isOwnProfile && (
          <button
            className="shrink-0 px-4 py-1.5 bg-primary text-white text-sm font-bold rounded-full hover:opacity-90 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            Follow
          </button>
        )}
        {isOwnProfile && (
          <button
            className="shrink-0 px-4 py-1.5 border border-border text-text-primary text-sm font-bold rounded-full hover:bg-white/5 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Edit
          </button>
        )}
      </div>

      {/* Name + username */}
      <div className="mt-2">
        <Link
          href={`/profile/${username}`}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="font-bold text-text-primary">@{username}</span>
        </Link>
      </div>

      {/* Bio */}
      <p className="mt-1 text-text-secondary text-sm leading-relaxed line-clamp-2">
        {/* Placeholder until data loads */}
        <span className="opacity-50">Loading...</span>
      </p>

      {/* Stats row */}
      <div className="mt-3 flex gap-4 text-sm">
        <span>
          <span className="font-bold text-text-primary">{formatCount(0)}</span>
          <span className="text-text-muted ml-1">Following</span>
        </span>
        <span>
          <span className="font-bold text-text-primary">{formatCount(0)}</span>
          <span className="text-text-muted ml-1">Followers</span>
        </span>
        <span>
          <span className="font-bold text-text-primary">{formatCount(0)}</span>
          <span className="text-text-muted ml-1">Likes</span>
        </span>
        <span>
          <span className="font-bold text-text-primary">{formatCount(0)}</span>
          <span className="text-text-muted ml-1">Likes today</span>
        </span>
      </div>
    </div>
  )
}
