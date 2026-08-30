'use client'

import { useEffect, useRef, useState } from 'react'

interface OriginalPost {
  id: string
  content: string
  user: {
    username: string
    displayName: string
    avatarUrl: string | null
  }
}

interface QuoteModalProps {
  originalPost: OriginalPost
  onSubmit: (content: string) => Promise<void>
  onClose: () => void
}

export default function QuoteModal({ originalPost, onSubmit, onClose }: QuoteModalProps) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea on open
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Close on Escape / backdrop
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(content.trim())
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const avatar =
    originalPost.user.avatarUrl ||
    `https://api.dicebear.com/7.x/identicon/svg?seed=${originalPost.user.username}`

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#200448] border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button
            onClick={onClose}
            className="material-symbols-outlined text-text-muted hover:text-text-primary transition-colors"
          >
            close
          </button>
          <span className="text-sm font-bold text-text-primary">Quote Post</span>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="px-4 py-1.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-full transition-colors"
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>

        {/* Quote textarea */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment..."
            rows={4}
            className="w-full bg-transparent text-text-primary placeholder-text-muted resize-none focus:outline-none text-base leading-relaxed"
            maxLength={500}
          />
        </div>

        {/* Original post preview */}
        <div className="mx-4 mb-4 border border-border rounded-xl p-3 bg-black/20">
          <div className="flex items-start gap-2">
            <img
              src={avatar}
              alt={originalPost.user.displayName || originalPost.user.username}
              className="w-8 h-8 rounded-full shrink-0 mt-0.5"
            />
            <div className="min-w-0">
              <span className="font-bold text-text-primary text-sm">
                {originalPost.user.displayName || originalPost.user.username}
              </span>
              <span className="text-text-muted text-sm ml-1">
                @{originalPost.user.username}
              </span>
              <p className="text-text-primary text-sm mt-1 break-words">
                {originalPost.content}
              </p>
            </div>
          </div>
        </div>

        {/* Character count */}
        <div className="px-4 pb-4 flex justify-end">
          <span className={`text-xs ${content.length > 450 ? 'text-red-400' : 'text-text-muted'}`}>
            {content.length}/500
          </span>
        </div>
      </div>
    </div>
  )
}
