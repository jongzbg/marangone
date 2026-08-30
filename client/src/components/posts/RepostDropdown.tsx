'use client'

import { useEffect, useRef } from 'react'

interface RepostDropdownProps {
  postId: string
  isReposted: boolean
  onRepost: () => void
  onQuote: () => void
  onClose: () => void
}

export default function RepostDropdown({
  isReposted,
  onRepost,
  onQuote,
  onClose,
}: RepostDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Slight delay so the click that opens the dropdown doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-0 mb-2 w-52 bg-[#200448] border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
    >
      {/* Repost (no quote) */}
      <button
        onClick={() => {
          onRepost()
          onClose()
        }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <span className="material-symbols-outlined text-text-primary text-xl">repeat</span>
        <div>
          <div className="text-text-primary text-sm font-bold">
            {isReposted ? 'Undo repost' : 'Repost'}
          </div>
          <div className="text-text-muted text-xs">
            {isReposted ? 'Remove this from your profile' : 'Share this post to your followers'}
          </div>
        </div>
      </button>

      {/* Divider */}
      <div className="border-t border-border mx-2" />

      {/* Quote post */}
      <button
        onClick={() => {
          onQuote()
          onClose()
        }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <span className="material-symbols-outlined text-text-primary text-xl">chat_bubble</span>
        <div>
          <div className="text-text-primary text-sm font-bold">Quote</div>
          <div className="text-text-muted text-xs">Add a comment before sharing</div>
        </div>
      </button>
    </div>
  )
}
