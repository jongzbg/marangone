'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { API_BASE_URL } from '@/lib/api'

interface TopCreator {
  username: string
  displayName: string | null
  avatarUrl: string | null
  _count: { followers: number; posts: number }
  likesTodayCount?: number
}

interface MostLikedUser {
  username: string
  displayName: string | null
  avatarUrl: string | null
  _count: { followers: number; posts: number }
  likesCount?: number
  likesTodayCount?: number
}

// Handle avatar URL: absolute URL, relative URL (prepend API_BASE_URL), or DiceBear fallback
// Note: Backend URLs (http://localhost:3001) are kept as-is since the backend serves files
const avatarSrc = (url: string | null | undefined, username: string) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    // Keep backend URLs as-is - browser can load images from different port
    return url;
  }
  if (url && url.startsWith('/')) {
    // Relative URL - prepend API base URL
    return `${API_BASE_URL}${url}`;
  }
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`;
};

export default function LeftSidebar() {
  const [creators, setCreators] = useState<TopCreator[]>([])
  const [mostLiked, setMostLiked] = useState<MostLikedUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = () => {
      const token = localStorage.getItem('token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      fetch(`${API_BASE_URL}/users/top/creators`, { headers })
        .then(r => r.json())
        .then(data => setCreators(Array.isArray(data) ? data.slice(0, 5) : []))
        .catch(() => setCreators([]))

      fetch(`${API_BASE_URL}/users/most-likes`, { headers })
        .then(r => r.json())
        .then(data => setMostLiked(Array.isArray(data) ? data.slice(0, 5) : []))
        .catch(() => setMostLiked([]))
        .finally(() => setLoading(false))
    }

    fetchData()
    window.addEventListener('nexus:like-changed', fetchData)
    return () => window.removeEventListener('nexus:like-changed', fetchData)
  }, [])

  return (
    <aside className="hidden lg:flex flex-col w-64 fixed left-[calc(50%-650px)] top-16 h-[100dvh] p-4 space-y-6 overflow-y-auto custom-scrollbar">
      {/* Most Likes Card */}
      <div className="bg-surface-elevated rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-headline-md text-text-primary">Total likes</h2>
        </div>
        <div className="flex flex-col">
          {loading ? (
            <p className="p-4 text-sm text-text-muted">Loading...</p>
          ) : mostLiked.length === 0 ? (
            <p className="p-4 text-sm text-text-muted">No posts yet</p>
          ) : (
            mostLiked.map((user) => (
              <Link
                key={user.username}
                href={`/profile/${user.username}`}
                className="p-4 flex items-center gap-3 hover:bg-border cursor-pointer transition-colors"
              >
                <img
                  alt={user.displayName || user.username}
                  className="w-10 h-10 rounded-full bg-surface-base"
                  src={avatarSrc(user.avatarUrl, user.username)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary truncate">{user.displayName || user.username}</p>
                  <p className="text-xs text-text-muted truncate">@{user.username}</p>
                </div>
                <span className="text-sm font-bold text-primary">❤️ {user.likesCount ?? 0}</span>
              </Link>
            ))
          )}
        </div>
        <button className="w-full p-4 text-primary text-sm font-medium hover:bg-border text-left transition-colors">
          Show more
        </button>
      </div>

      {/* Today's likes Card */}
      <div className="bg-surface-elevated rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-headline-md text-text-primary">Today's likes</h2>
        </div>
        <div className="flex flex-col">
          {loading ? (
            <p className="p-4 text-sm text-text-muted">Loading...</p>
          ) : creators.length === 0 ? (
            <p className="p-4 text-sm text-text-muted">No posts yet</p>
          ) : (
            creators.map((creator) => (
              <Link
                key={creator.username}
                href={`/profile/${creator.username}`}
                className="p-4 flex items-center gap-3 hover:bg-border cursor-pointer transition-colors"
              >
                <img
                  alt={creator.displayName || creator.username}
                  className="w-10 h-10 rounded-full bg-surface-base"
                  src={avatarSrc(creator.avatarUrl, creator.username)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary truncate">{creator.displayName || creator.username}</p>
                  <p className="text-xs text-text-muted truncate">@{creator.username}</p>
                </div>
                <span className="text-xs font-bold text-primary">❤️ {creator.likesTodayCount ?? 0}</span>
              </Link>
            ))
          )}
        </div>
        <button className="w-full p-4 text-primary text-sm font-medium hover:bg-border text-left transition-colors">
          Show more
        </button>
      </div>

      {/* Footer Links */}
      <div className="p-4 text-xs text-text-muted space-y-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <a className="hover:underline" href="#">Terms of Service</a>
          <a className="hover:underline" href="#">Privacy Policy</a>
          <a className="hover:underline" href="#">Cookie Policy</a>
          <a className="hover:underline" href="#">Accessibility</a>
        </div>
        <p>© 2024 Nexus Social Inc.</p>
      </div>
    </aside>
  )
}