'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { userApi, API_BASE_URL } from '@/lib/api'

interface FollowUser {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  isFollowing: boolean
  followersCount: number
  followingCount: number
  postsCount: number
}

interface FollowListModalProps {
  username: string
  initialTab: 'followers' | 'following'
  currentUserId: string
  onClose: () => void
  onFollowChanged?: () => void
}

const avatarSrc = (url: string | null | undefined, username: string) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) return url
  if (url && url.startsWith('/')) return `${API_BASE_URL}${url}`
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`
}

export default function FollowListModal({ username, initialTab, currentUserId, onClose, onFollowChanged }: FollowListModalProps) {
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab)
  const [users, setUsers] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    setLoading(true)
    const fetchUsers = tab === 'followers'
      ? userApi.getFollowers(username)
      : userApi.getFollowing(username)

    fetchUsers
      .then(res => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [username, tab])

  const handleFollow = async (userId: string, currentlyFollowing: boolean) => {
    try {
      if (currentlyFollowing) {
        await userApi.unfollow(userId)
      } else {
        await userApi.follow(userId)
      }
      setUsers(current => current.map(u =>
        u.id === userId
          ? { ...u, isFollowing: !currentlyFollowing, followersCount: currentlyFollowing ? u.followersCount - 1 : u.followersCount + 1 }
          : u
      ))
      onFollowChanged?.()
    } catch (err) {
      console.error('Failed to update follow:', err)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-elevated border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button
            onClick={onClose}
            className="material-symbols-outlined text-text-muted hover:text-text-primary transition-colors"
          >
            close
          </button>
          <span className="text-sm font-bold text-text-primary">{username}</span>
          <div className="w-9" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab('following')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              tab === 'following' ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Following
            {tab === 'following' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
          </button>
          <button
            onClick={() => setTab('followers')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              tab === 'followers' ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Followers
            {tab === 'followers' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-text-muted">Loading...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-text-muted">
              {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </div>
          ) : (
            users.map(user => (
              <div key={user.id} className="flex items-center gap-3 p-4 hover:bg-border/50 transition-colors">
                <Link href={`/profile/${user.username}`} onClick={onClose}>
                  <img
                    src={avatarSrc(user.avatarUrl, user.username)}
                    alt={user.displayName || user.username}
                    className="w-12 h-12 rounded-full bg-surface-base shrink-0"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/profile/${user.username}`}
                    onClick={onClose}
                    className="hover:underline"
                  >
                    <span className="font-bold text-text-primary text-sm block truncate">
                      {user.displayName || user.username}
                    </span>
                  </Link>
                  <span className="text-text-muted text-sm">@{user.username}</span>
                  {user.bio && (
                    <p className="text-text-muted text-sm mt-1 line-clamp-2">{user.bio}</p>
                  )}
                  <div className="flex gap-4 mt-1 text-xs text-text-muted">
                    <span>{user.followersCount} Followers</span>
                    <span>{user.followingCount} Following</span>
                  </div>
                </div>
                {user.id !== currentUserId && (
                  <button
                    onClick={() => handleFollow(user.id, user.isFollowing)}
                    className={`px-4 py-1.5 text-sm font-bold rounded-full transition-colors shrink-0 ${
                      user.isFollowing
                        ? 'border border-border text-text-primary hover:border-red-500 hover:text-red-500'
                        : 'bg-primary text-white hover:bg-primary/80'
                    }`}
                  >
                    {user.isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}