'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send } from 'lucide-react'
import { postApi } from '@/lib/api'
import { formatDistanceToNow } from '@/lib/format'

interface CommentUser {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

interface Comment {
  id: string
  content: string
  createdAt: string
  user: CommentUser
}

interface CommentModalProps {
  post: {
    id: string
    content: string
    user: CommentUser
    avatarUrl?: string | null
  }
  onClose: () => void
  onCommentAdded: (comment: Comment) => void
  onCommentDeleted: (commentId: string) => void
  currentUser: CommentUser
}

export default function CommentModal({ post, onClose, onCommentAdded, onCommentDeleted, currentUser }: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load comments
  useEffect(() => {
    setLoading(true)
    postApi.getComments(post.id).then((res) => {
      setComments(res.data.comments || [])
      setCursor(res.data.nextCursor || null)
      setHasMore(!!res.data.nextCursor)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [post.id])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = () => setOpenDropdownId(null)
    if (openDropdownId) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [openDropdownId])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [content])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await postApi.createComment(post.id, content.trim())
      setComments((prev) => [...prev, res.data])
      onCommentAdded(res.data)
      setContent('')
      setCursor(null)
      setHasMore(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      await postApi.deleteComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setOpenDropdownId(null)
      onCommentDeleted(commentId)
    } catch {
      // silent
    }
  }

  const canDelete = (comment: Comment) => {
    return currentUser.id === comment.user.id || currentUser.id === post.user.id
  }

  const avatarSrc = (url: string | null | undefined, username: string) =>
    url || `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`

  const toggleDropdown = (e: React.MouseEvent, commentId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setOpenDropdownId(openDropdownId === commentId ? null : commentId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#200D21] border border-[#3F3F3F] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[#3F3F3F]/50 text-text-muted hover:text-text-primary transition-colors flex items-center justify-center"
          >
            <X size={20} />
          </button>
          <h3 className="text-base font-bold text-text-primary m-0">Comments</h3>
        </div>

        {/* Original post preview */}
        <div className="flex gap-3 px-4 py-4 border-b border-border">
          <img
            src={avatarSrc(post.user.avatarUrl, post.user.username)}
            alt={post.user.displayName || post.user.username}
            className="w-10 h-10 rounded-full shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm text-text-primary">
              {post.user.displayName || post.user.username}
            </span>
            <span className="text-text-muted text-sm ml-1">@{post.user.username}</span>
            <p className="text-sm text-text-primary mt-1 break-words">{post.content}</p>
          </div>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="p-8 text-center text-text-muted text-sm">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">No comments yet. Be the first!</div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 px-4 py-3 relative hover:bg-white/[0.03] transition-colors group">
                <img
                  src={avatarSrc(comment.user.avatarUrl, comment.user.username)}
                  alt={comment.user.displayName || comment.user.username}
                  className="w-9 h-9 rounded-full shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-bold text-sm text-text-primary">
                      {comment.user.displayName || comment.user.username}
                    </span>
                    <span className="text-text-muted text-sm">@{comment.user.username}</span>
                    <span className="text-text-muted text-sm">·</span>
                    <span className="text-text-muted text-sm">{formatDistanceToNow(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-text-primary mt-1 break-words">{comment.content}</p>
                </div>

                {/* ... dropdown */}
                {canDelete(comment) && (
                  <div className="relative">
                    <button
                      className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-[#3F3F3F]/50 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={(e) => toggleDropdown(e, comment.id)}
                    >
                      <span className="material-symbols-outlined text-lg">more_horiz</span>
                    </button>

                    {openDropdownId === comment.id && (
                      <div
                        className="absolute right-0 top-8 w-52 bg-[#200D21] border border-[#3F3F3F] rounded-xl shadow-2xl z-50 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#3F3F3F]/30 transition-colors text-left"
                        >
                          <span className="material-symbols-outlined text-red-500">delete</span>
                          <span className="text-text-primary font-medium">ลบ</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {hasMore && cursor && (
            <button
              className="block mx-auto my-2 px-4 py-2 text-sm text-primary hover:underline bg-none border-none cursor-pointer font-medium"
              onClick={async () => {
                const res = await postApi.getComments(post.id, cursor)
                setComments((prev) => [...prev, ...(res.data.comments || [])])
                setCursor(res.data.nextCursor || null)
                setHasMore(!!res.data.nextCursor)
              }}
            >
              Load more
            </button>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Reply input */}
        <form className="flex gap-3 items-end px-4 py-3 border-t border-border" onSubmit={handleSubmit}>
          <img
            src={avatarSrc(currentUser.avatarUrl, currentUser.username)}
            alt={currentUser.displayName || currentUser.username}
            className="w-9 h-9 rounded-full shrink-0"
          />
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent border-none outline-none resize-none text-base text-text-primary placeholder-text-muted leading-6 max-h-30 overflow-y-auto"
            placeholder="Post your reply"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={1}
          />
          <button
            type="submit"
            className="bg-primary border-none rounded-full w-9 h-9 flex items-center justify-center cursor-pointer text-white transition-colors hover:bg-[#1a8cd8] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            disabled={!content.trim() || submitting}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}
