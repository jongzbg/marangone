'use client'

import { useState, useRef } from 'react'
import RepostDropdown from './RepostDropdown'

interface PostActionsProps {
  postId: string
  liked: boolean
  reposted: boolean
  likeCount: number
  repostCount: number
  commentCount: number
  viewCount: string
  onLike: () => void
  onRepost: () => void
  onQuote: () => void
  onComment: (post: any) => void
  post: any
  isReposted: boolean
}

export default function PostActions({
  postId,
  liked,
  reposted,
  likeCount,
  repostCount,
  commentCount,
  viewCount,
  onLike,
  onRepost,
  onQuote,
  onComment,
  post,
  isReposted,
}: PostActionsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
    return count.toString()
  }

  const handleRepostClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setDropdownOpen((prev) => !prev)
  }

  return (
    <div className="flex items-center justify-between mt-3 px-4 text-text-muted relative">
      {/* Comments */}
      <button
        className="flex items-center gap-2 hover:text-primary transition-colors group"
        onClick={() => onComment(post)}
      >
        <span className="material-symbols-outlined text-lg group-hover:bg-primary/10 p-2 rounded-full">
          chat_bubble
        </span>
        <span className="text-xs">{commentCount}</span>
      </button>

      {/* Repost — opens dropdown */}
      <div ref={buttonRef} className="relative">
        <button
          onClick={handleRepostClick}
          className={`flex items-center gap-2 transition-colors group ${
            reposted
              ? 'text-green-500 hover:text-green-400'
              : 'hover:text-green-500'
          }`}
        >
          <span className="material-symbols-outlined text-lg group-hover:bg-green-500/10 p-2 rounded-full">
            repeat
          </span>
          <span className="text-xs">{formatCount(repostCount)}</span>
        </button>

        {dropdownOpen && (
          <RepostDropdown
            postId={postId}
            isReposted={reposted}
            onRepost={onRepost}
            onQuote={onQuote}
            onClose={() => setDropdownOpen(false)}
          />
        )}
      </div>

      {/* Like */}
      <button
        onClick={onLike}
        className={`flex items-center gap-2 hover:text-pink-500 transition-colors group ${
          liked ? 'text-pink-500' : ''
        }`}
      >
        <span
          className="material-symbols-outlined text-lg group-hover:bg-pink-500/10 p-2 rounded-full"
          style={{ fontVariationSettings: liked ? "'FILL' 1" : "'FILL' 0" }}
        >
          favorite
        </span>
        <span className="text-xs">{formatCount(likeCount)}</span>
      </button>
    </div>
  )
}
