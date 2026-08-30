'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { hashtagApi } from '@/lib/api'

interface TrendingHashtag {
  tag: string
  postsCount: number
}

export default function RightSidebar() {
  const [trending, setTrending] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTrending = () => {
    setLoading(true)
    hashtagApi.getTrending()
      .then(res => setTrending(Array.isArray(res.data) ? res.data.slice(0, 5) : []))
      .catch(() => setTrending([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTrending()
    window.addEventListener('nexus:post-created', fetchTrending)
    return () => window.removeEventListener('nexus:post-created', fetchTrending)
  }, [])

  return (
    <aside className="hidden xl:flex flex-col w-80 fixed right-[calc(50%-650px)] top-16 h-[calc(100vh-64px)] p-4 space-y-4 overflow-y-auto custom-scrollbar">
      {/* What's happening */}
      <div className="bg-surface-elevated rounded-2xl border border-border overflow-hidden">
        <div className="p-4">
          <h2 className="text-headline-md text-text-primary">What&apos;s happening</h2>
        </div>
        <div className="flex flex-col">
          {loading ? (
            <p className="p-4 text-sm text-text-muted">Loading...</p>
          ) : trending.length === 0 ? (
            <p className="p-4 text-sm text-text-muted">No trending hashtags</p>
          ) : (
            trending.map((item) => (
              <Link
                key={item.tag}
                href={`/hashtag/${encodeURIComponent(item.tag)}`}
                className="px-4 py-3 hover:bg-border cursor-pointer transition-colors"
              >
                <p className="text-xs text-text-muted">Trending in Nexus</p>
                <p className="text-sm font-bold text-text-primary">#{item.tag}</p>
                <p className="text-xs text-text-muted">{item.postsCount} Posts</p>
              </Link>
            ))
          )}
        </div>
        <button className="w-full p-4 text-primary text-sm font-medium hover:bg-border text-left transition-colors">
          Show more
        </button>
      </div>

      {/* Live Stream */}
      <div className="bg-surface-elevated rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-headline-md text-text-primary">Live</h2>
          <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase">Live</span>
        </div>
        <div className="relative group cursor-pointer">
          <img
            className="w-full aspect-video object-cover transition-opacity group-hover:opacity-80"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1BywWM3XKRMjbJxHR8sFQy4ll1uVNlC04YYfS_XLbdBdzotkJUNCb_A8U2AZ8GBuBCF270x3N7c-TNtmYnRBZb_REGTtGrXf-UNdf9qIEY5FcPTTzi2qXfRALHcjSw_KCqyYlwhyjhOflyeO9dulIJg8Bs_aFgd_FUctXINA3HoxBZbIDzmbMmK5ZRVThdCIvGwRZ4lb3AROfBU-3B6CPpNRU0oevsODVDPZIVjBoSLwUYwdglqVm5u0lxj7LZdPnYVBSuCSZvKM"
            alt="Live stream"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-text-primary text-5xl">play_circle</span>
          </div>
          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
            <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs text-text-primary">
              Nexus Talk Live
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}