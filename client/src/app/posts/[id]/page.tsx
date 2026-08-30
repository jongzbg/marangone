'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import MainLayout from '@/components/layout/MainLayout'
import PostCard from '@/components/posts/PostCard'
import CommentModal from '@/components/posts/CommentModal'
import QuoteModal from '@/components/posts/QuoteModal'
import UserHoverTrigger from '@/components/UserHoverTrigger'
import { postApi, authApi, videoApi } from '@/lib/api'
import { formatDistanceToNow, formatAbsoluteTime } from '@/lib/format'
import { PostSkeleton } from '@/components/Skeleton'

interface ThreadUser {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

interface ThreadReply {
  id: string
  content: string
  createdAt: string
  likesCount: number
  repostsCount: number
  repliesCount: number
  isLiked: boolean
  isReposted: boolean
  user: ThreadUser
  children: ThreadReply[]
}

interface ThreadPost {
  id: string
  content: string
  mediaUrls: string[]
  createdAt: string
  likesCount: number
  repostsCount: number
  commentsCount: number
  isLiked: boolean
  isReposted: boolean
  isPinned: boolean
  user: ThreadUser
  /** Video data — fetched from API, may need polling for pending/processing */
  video?: {
    id: string
    status: 'pending' | 'processing' | 'ready' | 'failed'
    videoUrl?: string
    thumbnailUrl?: string
    duration?: number
    error?: string
    resolutions?: string[]
    encodingProfile?: string
  }
  /** Quoted post when this post is a quote/repost of another post */
  quotedPost?: {
    id: string
    content: string
    mediaUrls?: string[]
    createdAt?: string
    user: { username: string; displayName?: string; avatarUrl?: string | null }
  }
}

interface ThreadData {
  post: ThreadPost
  replies: ThreadReply[]
}

function timeAgo(date: string): string {
  return formatDistanceToNow(date)
}

function avatarSrc(url: string | null | undefined, username: string) {
  return url || `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`
}

// ── Thread Reply Item ─────────────────────────────────────────────────
function ReplyItem({
  reply,
  postId,
  currentUserId,
  onReplyAdded,
  depth = 0,
}: {
  reply: ThreadReply
  postId: string
  currentUserId: string | null
  onReplyAdded: (parentId: string, newReply: ThreadReply) => void
  depth?: number
}) {
  const [liked, setLiked] = useState(reply.isLiked)
  const [likeCount, setLikeCount] = useState(reply.likesCount)
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [children, setChildren] = useState<ThreadReply[]>(reply.children || [])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleLike = async () => {
    const next = !liked
    setLiked(next)
    setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)))
    try {
      if (next) await postApi.toggleLike(reply.id)
      else await postApi.toggleLike(reply.id)
    } catch {
      setLiked(!next)
      setLikeCount((c) => (next ? c - 1 : c + 1))
    } finally {
      window.dispatchEvent(new CustomEvent('nexus:like-changed'))
    }
  }

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyContent.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await postApi.createReply(reply.id, replyContent.trim())
      const newReply: ThreadReply = {
        ...res.data,
        children: [],
      }
      setChildren((c) => [...c, newReply])
      onReplyAdded(reply.id, newReply)
      setReplyContent('')
      setShowReplyInput(false)
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`relative ${depth > 0 ? 'ml-6 pl-3 border-l-2 border-border' : ''}`}
    >
      <div className="flex gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
        {/* Avatar */}
        <UserHoverTrigger
          username={reply.user.username}
          avatar={avatarSrc(reply.user.avatarUrl, reply.user.username)}
          className="shrink-0 w-10 h-10"
        >
          <Link href={`/profile/${reply.user.username}`} className="w-10 h-10 block">
            <img
              src={avatarSrc(reply.user.avatarUrl, reply.user.username)}
              alt={reply.user.displayName || reply.user.username}
              className="w-10 h-10 rounded-full"
            />
          </Link>
        </UserHoverTrigger>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <UserHoverTrigger
              username={reply.user.username}
              avatar={avatarSrc(reply.user.avatarUrl, reply.user.username)}
              className="flex items-center gap-1"
            >
              <Link
                href={`/profile/${reply.user.username}`}
                className="font-bold text-sm text-text-primary hover:underline"
              >
                {reply.user.displayName || reply.user.username}
              </Link>
              <Link
                href={`/profile/${reply.user.username}`}
                className="text-text-muted text-sm hover:underline"
              >
                @{reply.user.username}
              </Link>
            </UserHoverTrigger>
            <span className="text-text-muted text-sm">·</span>
            <span className="text-text-muted text-sm">{timeAgo(reply.createdAt)}</span>
          </div>
          <p className="text-text-primary text-sm mt-1 break-words">{reply.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2 text-text-muted">
            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-sm transition-colors ${
                liked ? 'text-pink-500' : 'hover:text-pink-500'
              }`}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: liked ? "'FILL' 1" : "'FILL' 0" }}
              >
                favorite
              </span>
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>

            {/* Reply */}
            <button
              onClick={() => {
                setShowReplyInput(!showReplyInput)
                setTimeout(() => textareaRef.current?.focus(), 50)
              }}
              className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-lg">chat_bubble</span>
              {reply.repliesCount > 0 && <span>{reply.repliesCount}</span>}
            </button>
          </div>

          {/* Inline reply input */}
          {showReplyInput && (
            <form onSubmit={handleSubmitReply} className="mt-3 flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-primary transition-colors"
                placeholder={`Reply to @${reply.user.username}...`}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={2}
              />
              <button
                type="submit"
                disabled={!replyContent.trim() || submitting}
                className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                Reply
              </button>
            </form>
          )}

          {/* Nested children */}
          {children.map((child) => (
            <ReplyItem
              key={child.id}
              reply={child}
              postId={postId}
              currentUserId={currentUserId}
              onReplyAdded={onReplyAdded}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Post Detail Page ──────────────────────────────────────────────
export default function PostDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const postId = params.id

  const [thread, setThread] = useState<ThreadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUsername, setCurrentUsername] = useState<string | null>(null)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [reposted, setReposted] = useState(false)
  const [repostCount, setRepostCount] = useState(0)
  const [quotePost, setQuotePost] = useState<ThreadPost | null>(null)
  const [commentPost, setCommentPost] = useState<any>(null)
  const [videoData, setVideoData] = useState<ThreadPost['video'] | undefined>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }

    authApi.me()
      .then((res) => {
        setCurrentUserId(res.data.id)
        setCurrentUsername(res.data.username)
        setCurrentUserAvatar(res.data.avatarUrl || null)
      })
      .catch(() => {})
      .finally(() => fetchThread())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  const fetchThread = async () => {
    try {
      const res = await postApi.getThread(postId)
      setThread(res.data)
      setLiked(res.data.post.isLiked)
      setLikeCount(res.data.post.likesCount)
      setReposted(res.data.post.isReposted)
      setRepostCount(res.data.post.repostsCount)
      setVideoData(res.data.post.video)
    } catch {
      setError('ไม่พบโพสต์นี้')
    } finally {
      setLoading(false)
    }
  }

  // ── Video poll ────────────────────────────────────────────────────────────
  useEffect(() => {
    const vid = videoData
    if (!vid) return
    if (vid.status === 'ready' || vid.status === 'failed') return

    let cancelled = false
    let attempts = 0
    const maxAttempts = 15

    const poll = async () => {
      if (cancelled) return
      attempts++
      try {
        const res = await videoApi.getVideoStatus(postId)
        if (cancelled) return
        // Preserve duration from previous state if not returned by API
        const updated = { ...res.data }
        if (updated.duration == null && videoData?.duration) {
          updated.duration = videoData.duration
        }
        setVideoData(updated)
        if (res.data.status === 'ready' || res.data.status === 'failed') return
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000)
        }
      } catch {
        // silently stop polling on error
      }
    }

    const timer = setTimeout(poll, 2000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [postId, videoData])
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [replyContent])

  const handleLike = async () => {
    if (!thread) return
    const next = !liked
    setLiked(next)
    setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)))
    try {
      await postApi.toggleLike(postId)
    } catch {
      setLiked(!next)
      setLikeCount((c) => (next ? c - 1 : c + 1))
    } finally {
      window.dispatchEvent(new CustomEvent('nexus:like-changed'))
    }
  }

  const handleRepost = async () => {
    if (!thread) return
    const next = !reposted
    setReposted(next)
    setRepostCount((c) => (next ? c + 1 : Math.max(0, c - 1)))
    try {
      if (next) await postApi.repost(postId)
      else await postApi.unrepost(postId)
    } catch {
      setReposted(!next)
      setRepostCount((c) => (next ? c - 1 : c + 1))
    } finally {
      window.dispatchEvent(new CustomEvent('nexus:like-changed'))
    }
  }

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyContent.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await postApi.createReply(postId, replyContent.trim())
      const newReply: ThreadReply = {
        ...res.data,
        children: [],
      }
      setThread((t) =>
        t ? { ...t, replies: [...t.replies, newReply], post: { ...t.post, commentsCount: t.post.commentsCount + 1 } } : t
      )
      setReplyContent('')
      setTimeout(() => textareaRef.current?.focus(), 50)
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  // Add nested reply to correct parent
  const handleReplyAdded = (parentId: string, newReply: ThreadReply) => {
    const addToParent = (replies: ThreadReply[]): ThreadReply[] =>
      replies.map((r) =>
        r.id === parentId
          ? { ...r, repliesCount: r.repliesCount + 1, children: [...(r.children || []), newReply] }
          : { ...r, children: addToParent(r.children || []) }
      )
    setThread((t) =>
      t ? { ...t, replies: addToParent(t.replies) } : t
    )
  }

  const handleQuote = () => {
    if (!thread) return
    setQuotePost(thread.post)
  }

  const handleQuoteSubmit = async (content: string) => {
    if (!quotePost) return
    try {
      await postApi.quotePost(quotePost.id, content)
      setQuotePost(null)
    } catch {
      // silent
    }
  }

  const handleDelete = async () => {
    try {
      await postApi.deletePost(postId)
      router.push('/home')
    } catch {
      // silent
    }
  }

  const handlePin = async () => {
    try {
      await postApi.pinPost(postId)
      setThread((t) => t ? { ...t, post: { ...t.post, isPinned: true } } : t)
    } catch {
      // silent
    }
  }

  const handleUnpin = async () => {
    try {
      await postApi.unpinPost(postId)
      setThread((t) => t ? { ...t, post: { ...t.post, isPinned: false } } : t)
    } catch {
      // silent
    }
  }

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return n.toString()
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="divide-y divide-border">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      </MainLayout>
    )
  }

  if (error || !thread) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64 flex-col gap-4">
          <span className="text-red-500">{error || 'ไม่พบโพสต์'}</span>
          <button onClick={() => router.back()} className="text-primary hover:underline text-sm">
            ← กลับ
          </button>
        </div>
      </MainLayout>
    )
  }

  const { post, replies } = thread

  return (
    <MainLayout>
      {/* Header */}
      <div className="sticky top-16 z-40 bg-black/80 backdrop-blur-md px-4 h-14 flex items-center gap-4 border-b border-border">
        <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-surface-elevated text-text-primary">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h1 className="font-bold text-xl text-text-primary">Thread</h1>
      </div>

      {/* Main post */}
      {(() => {
        const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url)
        const imageUrls = (post.mediaUrls ?? []).filter((url: string) => !isVideo(url))
        return (
      <PostCard
        post={{
          id: post.id,
          user: {
            name: post.user.displayName || post.user.username,
            username: post.user.username,
            avatar: avatarSrc(post.user.avatarUrl, post.user.username),
          },
          content: post.content,
          images: imageUrls.length ? imageUrls : undefined,
          video: post.video,
          liked,
          reposted,
          isPinned: post.isPinned,
          time: timeAgo(post.createdAt),
          absoluteTime: formatAbsoluteTime(post.createdAt),
          stats: {
            comments: post.commentsCount,
            reposts: repostCount,
            likes: likeCount,
            views: `${likeCount * 10}+`,
          },
          // Pass quotedPost so thread page shows the quoted block
          quotedPost: post.quotedPost,
        }}
        rawPost={thread.post}
        onLike={handleLike}
        onRepost={handleRepost}
        onQuote={handleQuote}
        onDelete={handleDelete}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onComment={setCommentPost}
        currentUsername={currentUsername || undefined}
        onClick={(e) => e.preventDefault()}
      />
        )
      })()}

      {/* Reply input */}
      {currentUserId && (
        <form
          onSubmit={handleSubmitReply}
          className="flex gap-3 px-4 py-3 border-b border-border items-end"
        >
          <Link href={`/profile/${currentUsername}`} className="shrink-0">
            <img
              src={currentUserAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUsername}`}
              alt={currentUsername || 'you'}
              className="w-10 h-10 rounded-full"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              className="w-full bg-transparent border-none outline-none resize-none text-text-primary placeholder-text-muted text-base leading-relaxed"
              placeholder={`Reply to @${post.user.username}...`}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={1}
            />
            {replyContent.trim() && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-text-muted">
                  Replying to <span className="text-primary">@{post.user.username}</span>
                </span>
                <button
                  type="submit"
                  disabled={!replyContent.trim() || submitting}
                  className="bg-primary text-white text-sm font-bold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  Reply
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {/* Replies thread */}
      <div>
        {replies.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            No replies yet. Be the first to reply!
          </div>
        ) : (
          replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              postId={postId}
              currentUserId={currentUserId}
              onReplyAdded={handleReplyAdded}
              depth={0}
            />
          ))
        )}
      </div>

      {/* Quote Modal */}
      {quotePost && (
        <QuoteModal
          originalPost={{
            id: quotePost.id,
            content: quotePost.content,
            user: {
              username: quotePost.user.username,
              displayName: quotePost.user.displayName || quotePost.user.username,
              avatarUrl: quotePost.user.avatarUrl,
            },
          }}
          onSubmit={handleQuoteSubmit}
          onClose={() => setQuotePost(null)}
        />
      )}

      {/* Comment Modal */}
      {commentPost && currentUserId && (
        <CommentModal
          post={{
            id: commentPost.id,
            content: commentPost.content,
            user: {
              id: commentPost.user.id,
              username: commentPost.user.username,
              displayName: commentPost.user.displayName,
              avatarUrl: commentPost.user.avatarUrl,
            },
            avatarUrl: commentPost.user.avatarUrl,
          }}
          onClose={() => setCommentPost(null)}
          onCommentAdded={() => {
            // Refresh thread to update comment count
            fetchThread()
          }}
          onCommentDeleted={() => {
            fetchThread()
          }}
          currentUser={{
            id: currentUserId,
            username: currentUsername || '',
            displayName: currentUsername || '',
            avatarUrl: currentUserAvatar,
          }}
        />
      )}
    </MainLayout>
  )
}
