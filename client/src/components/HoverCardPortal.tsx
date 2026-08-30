'use client'

import { useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useUserHoverCard, HoverCardUserData } from '@/contexts/UserHoverCardContext'
import { userApi } from '@/lib/api'

// ─── Positioning helpers ──────────────────────────────────────────────────────

const CARD_WIDTH = 380

function getPlacement(rect: DOMRect): 'top' | 'bottom' {
  const spaceBelow = window.innerHeight - rect.bottom
  return spaceBelow < 220 ? 'top' : 'bottom'
}

function getStyle(rect: DOMRect, placement: 'top' | 'bottom'): React.CSSProperties {
  let top: number
  if (placement === 'bottom') {
    top = rect.bottom + 8
  } else {
    top = rect.top - 8
  }

  let left = rect.left
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

// ─── Number formatter ──────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Skeleton card while loading ──────────────────────────────────────────────

function SkeletonCard({ username, style, onMouseEnter, onMouseLeave }: { username: string; style: React.CSSProperties; onMouseEnter: () => void; onMouseLeave: () => void }) {
  return (
    <div
      style={style}
      className="bg-surface-elevated border border-border rounded-2xl shadow-2xl p-4 animate-pulse"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="w-14 h-14 rounded-full bg-white/10 shrink-0" />
        <div className="w-20 h-8 rounded-full bg-white/10 shrink-0" />
      </div>
      <div className="mt-2 space-y-1">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="h-3 w-40 rounded bg-white/10" />
        <div className="h-3 w-32 rounded bg-white/10" />
      </div>
      <div className="mt-3 flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-3 w-12 rounded bg-white/10" />
        ))}
      </div>
    </div>
  )
}

// ─── Main card content ────────────────────────────────────────────────────────

function CardContent({ userData, style, onCancelHide, onMouseLeave, onFollow, onHide, isOwnProfile }: {
  userData: HoverCardUserData
  style: React.CSSProperties
  /** เรียก cancelHide — ป้องกัน hideTimer ของ trigger ที่กำลังทำงาน */
  onCancelHide: () => void
  onMouseLeave: () => void
  onFollow: (userId: string, currentlyFollowing: boolean) => void
  onHide: () => void
  /** true = this card belongs to the logged-in user → hide follow button */
  isOwnProfile: boolean
}) {
  return (
    <div
      style={style}
      className="bg-surface-elevated border border-border rounded-2xl shadow-2xl p-4"
      onMouseEnter={onCancelHide}
      onMouseLeave={onMouseLeave}
    >
      {/* Header row: avatar + action button */}
      <div className="flex justify-between items-start gap-3">
        <Link
          href={`/profile/${userData.username}`}
          className="shrink-0 w-14 h-14 rounded-full overflow-hidden hover:ring-2 hover:ring-primary transition-all"
          onClick={(e) => { e.stopPropagation(); onHide() }}
        >
          <img
            alt={userData.name}
            className="w-full h-full object-cover"
            src={userData.avatar}
          />
        </Link>

        {/* Action button — hide when viewing own profile */}
        {!isOwnProfile && (
          <button
            className="shrink-0 px-4 py-1.5 bg-primary text-white text-sm font-bold rounded-full hover:opacity-90 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              onFollow(userData.userId, userData.isFollowing ?? false)
            }}
          >
            {userData.isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Name */}
      <div>
        <Link
          href={`/profile/${userData.username}`}
          className="hover:underline"
          onClick={(e) => { e.stopPropagation(); onHide() }}
        >
          <span className="font-bold text-text-primary">{userData.name}</span>
        </Link>
        <Link
          href={`/profile/${userData.username}`}
          className="block text-text-muted text-sm hover:underline"
          onClick={(e) => { e.stopPropagation(); onHide() }}
        >
          @{userData.username}
        </Link>
      </div>

      {/* Bio */}
      {userData.bio && (
        <p className="mt-2 text-text-secondary text-sm leading-relaxed line-clamp-2">
          {userData.bio}
        </p>
      )}

      {/* Stats row */}
      <div className="mt-3 flex gap-4 text-sm overflow-hidden">
        <span className="whitespace-nowrap">
          <span className="font-bold text-text-primary">{formatCount(userData.following)}</span>
          <span className="text-text-muted ml-1">Following</span>
        </span>
        <span className="whitespace-nowrap">
          <span className="font-bold text-text-primary">{formatCount(userData.followers)}</span>
          <span className="text-text-muted ml-1">Followers</span>
        </span>
        <span className="whitespace-nowrap">
          <span className="font-bold text-text-primary">{formatCount(userData.likes)}</span>
          <span className="text-text-muted ml-1">Likes</span>
        </span>
        {userData.likesToday !== undefined && (
          <span className="whitespace-nowrap">
            <span className="font-bold text-text-primary">{formatCount(userData.likesToday)}</span>
            <span className="text-text-muted ml-1">Likes today</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main portal ──────────────────────────────────────────────────────────────

export default function HoverCardPortal() {
  const { visible, triggerData, userData, hide, updateData, setCurrentUsername, cardMounted, cancelHide, currentUsername } = useUserHoverCard()
  const hasFetched = useRef(false)
  const usernameFetched = useRef(false)
  const hasCalledMounted = useRef(false)

  // Follow / Unfollow toggle
  const handleFollow = async (userId: string, currentlyFollowing: boolean) => {
    if (!userData) return
    const newFollowers = currentlyFollowing
      ? Math.max(0, userData.followers - 1)
      : userData.followers + 1

    // Optimistic update
    updateData({ ...userData, isFollowing: !currentlyFollowing, followers: newFollowers })

    try {
      if (currentlyFollowing) {
        await userApi.unfollow(userId)
      } else {
        await userApi.follow(userId)
      }
      // Notify other components (e.g. ProfileHeader of the logged-in user)
      window.dispatchEvent(new CustomEvent('nexus:follow-changed', {
        detail: {
          byUsername: currentUsername, // logged-in user who just followed
          targetUsername: userData.username, // user being followed
          following: !currentlyFollowing,
          followerCount: newFollowers,
        },
      }))
    } catch {
      // Revert on error
      updateData({ ...userData })
    }
  }
  // Fetch logged-in username on mount
  useEffect(() => {
    if (usernameFetched.current) return
    usernameFetched.current = true
    const token = localStorage.getItem('token')
    if (!token) return
    import('@/lib/api').then(({ authApi }) => {
      authApi.me().then((res: any) => {
        setCurrentUsername(res.data.username)
      }).catch(() => {})
    }).catch(() => {})
  }, [setCurrentUsername])

  // Fetch user profile when card becomes visible
  useEffect(() => {
    if (!visible || !triggerData) {
      hasFetched.current = false
      return
    }
    if (hasFetched.current) return
    hasFetched.current = true

    userApi.getProfile(triggerData.username).then((res) => {
      const p = res.data
      updateData({
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

    return () => { hasFetched.current = false }
  }, [visible, triggerData, updateData])

  // Cancel any pending hide timer when card actually mounts
  // useLayoutEffect runs synchronously after DOM mutations, BEFORE browser paint
  useLayoutEffect(() => {
    if (!visible || !triggerData) {
      hasCalledMounted.current = false
      return
    }
    if (hasCalledMounted.current) return
    hasCalledMounted.current = true
    cardMounted(triggerData.username)
  }, [visible, triggerData, cardMounted])

  if (!visible || !triggerData) return null

  const placement = getPlacement(triggerData.rect)
  const style = getStyle(triggerData.rect, placement)

  const isOwnProfile = currentUsername !== null && userData !== null && currentUsername === userData.username

  const card = userData ? (
    <CardContent
      userData={userData}
      style={style}
      onCancelHide={cancelHide}
      onMouseLeave={hide}
      onFollow={handleFollow}
      onHide={hide}
      isOwnProfile={isOwnProfile}
    />
  ) : (
    <SkeletonCard username={triggerData.username} style={style} onMouseEnter={cancelHide} onMouseLeave={hide} />
  )

  return createPortal(card, document.body)
}
