'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import UserHoverTrigger from '@/components/UserHoverTrigger'

interface ProfileHeaderProps {
  user: {
    id: string
    name: string
    username: string
    bio: string
    location?: string
    website?: string
    joinedDate: string
    followers: number
    following: number
    likes: number
    likesToday?: number
    avatar: string
    banner: string
    isFollowing?: boolean
  }
  isOwnProfile?: boolean
  onFollow?: () => void
  onMessage?: () => void
  onFollowersClick?: () => void
  onFollowingClick?: () => void
}

export default function ProfileHeader({ user, isOwnProfile = false, onFollow, onMessage, onFollowersClick, onFollowingClick }: ProfileHeaderProps) {
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  // Local state so follow from HoverCardPortal can update stats
  const [isFollowing, setIsFollowing] = useState(user.isFollowing ?? false)
  const [followers, setFollowers] = useState(user.followers)
  const [following, setFollowing] = useState(user.following)

  // Listen for follow changes from HoverCardPortal (custom event)
  useEffect(() => {
    const handler = (e: Event) => {
      const { byUsername, targetUsername, following, followerCount } = (e as CustomEvent).detail
      // If this profile's user is the one being followed/unfollowed by the logged-in user
      if (targetUsername === user.username) {
        setIsFollowing(following)
        setFollowers(followerCount)
      }
      // If this is the logged-in user's own profile — update their following count
      if (byUsername === user.username) {
        setFollowing((prev) => following ? prev + 1 : Math.max(0, prev - 1))
      }
    }
    window.addEventListener('nexus:follow-changed', handler)
    return () => window.removeEventListener('nexus:follow-changed', handler)
  }, [user.username])

  const handleFollow = () => {
    const newFollowing = !isFollowing
    const newFollowers = newFollowing ? followers + 1 : Math.max(0, followers - 1)
    setIsFollowing(newFollowing)
    setFollowers(newFollowers)
    window.dispatchEvent(new CustomEvent('nexus:follow-changed', {
      detail: { username: user.username, following: newFollowing, followerCount: newFollowers },
    }))
    onFollow?.()
  }

  return (
    <>
      {/* Banner — hover trigger (banner is not the profile card itself) */}
      <section className="relative">
        <UserHoverTrigger
          username={user.username}
          avatar={user.avatar}
          className="block"
        >
          <div className="h-48 w-full bg-surface-elevated">
            {user.banner ? (
              <img
                alt="Profile banner"
                className="w-full h-full object-cover opacity-80"
                src={user.banner}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-primary/30 to-black" />
            )}
          </div>
        </UserHoverTrigger>
        <div className="px-4 -mt-16 flex justify-between items-end relative z-10">
          <div>
            {/* Click avatar to open full-size image */}
            <button
              onClick={() => setAvatarModalOpen(true)}
              className="p-1 bg-black rounded-full hover:ring-2 hover:ring-primary transition-all cursor-pointer"
            >
              <img
                alt="Profile avatar"
                className="w-32 h-32 rounded-full object-cover border-4 border-black"
                src={user.avatar}
              />
            </button>
          </div>
          {isOwnProfile ? (
            <Link
              href="/edit-profile"
              className="mb-4 px-6 py-2 border border-border text-text-primary font-bold rounded-full hover:bg-surface-elevated transition-colors"
            >
              Edit Profile
            </Link>
          ) : (
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => onMessage?.()}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  mail
                </span>
              </button>
              <button
                onClick={handleFollow}
                className={`px-6 py-2 font-bold rounded-full transition-colors ${
                  isFollowing
                    ? 'border border-border text-text-primary hover:bg-red-500/10 hover:border-red-500 hover:text-red-500'
                    : 'bg-primary text-white hover:opacity-90'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          )}
        </div>
        <div className="px-4 mt-4 space-y-3">
          {/* Name & username — no hover trigger on profile page itself */}
          <div>
            <h2 className="text-display-lg text-text-primary">{user.name}</h2>
            <p className="text-text-muted">@{user.username}</p>
          </div>
          <p className="text-text-primary leading-relaxed">{user.bio}</p>
          <div className="flex flex-wrap gap-4 text-text-muted text-body-sm">
            {user.location && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">location_on</span>
                {user.location}
              </div>
            )}
            {user.website && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">link</span>
                <span className="text-primary hover:underline cursor-pointer">{user.website}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              Joined {user.joinedDate}
            </div>
          </div>
          <div className="flex gap-5 pb-4">
            <button onClick={onFollowingClick} className="hover:underline cursor-pointer text-left">
              <span className="font-bold text-text-primary">{following.toLocaleString()}</span>
              <span className="text-text-muted"> Following</span>
            </button>
            <button onClick={onFollowersClick} className="hover:underline cursor-pointer text-left">
              <span className="font-bold text-text-primary">{followers.toLocaleString()}</span>
              <span className="text-text-muted"> Followers</span>
            </button>
            <div className="hover:underline cursor-pointer">
              <span className="font-bold text-text-primary">{user.likes.toLocaleString()}</span>
              <span className="text-text-muted"> Likes</span>
            </div>
            {user.likesToday !== undefined && (
              <div className="hover:underline cursor-pointer">
                <span className="font-bold text-text-primary">{user.likesToday.toLocaleString()}</span>
                <span className="text-text-muted"> Likes today</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs rendered by parent (ProfilePage) */}
      </section>

      {/* Avatar full-size modal */}
      {avatarModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setAvatarModalOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl font-light cursor-pointer"
            onClick={() => setAvatarModalOpen(false)}
          >
            ✕
          </button>
          <img
            alt="Profile avatar"
            className="max-w-full max-h-full rounded-2xl object-contain"
            src={user.avatar}
          />
        </div>
      )}
    </>
  )
}
