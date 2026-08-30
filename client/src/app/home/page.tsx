'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import PostComposer from '@/components/posts/PostComposer'
import PostCard from '@/components/posts/PostCard'
import QuoteModal from '@/components/posts/QuoteModal'
import CommentModal from '@/components/posts/CommentModal'
import { authApi, postApi } from '@/lib/api'
import { formatDistanceToNow, formatAbsoluteTime } from '@/lib/format'
import { PostSkeleton } from '@/components/Skeleton'

interface VideoInfo {
  id: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  duration?: number
  error?: string
  resolutions?: string[]
  encodingProfile?: string
}

interface ApiPost {
  id: string
  content: string
  mediaUrls: string[]
  video?: VideoInfo
  likesCount: number
  repostsCount: number
  commentsCount: number
  createdAt: string
  isLiked?: boolean
  isReposted?: boolean
  isPinned?: boolean
  user: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
  }
  // For quote posts — embedded parent post
  parentPost?: {
    id: string
    content: string
    user: {
      username: string
      displayName: string
      avatarUrl: string | null
    }
  }
  quotedPost?: {
    id: string
    content: string
    mediaUrls?: string[]
    createdAt?: string
    user: { username: string; displayName?: string; avatarUrl?: string | null }
  }
  repostedBy?: {
    id: string
    username: string
    displayName?: string | null
    avatarUrl?: string | null
  }
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export default function HomePage() {
  const router = useRouter()
  const [posts, setPosts] = useState<ApiPost[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; avatarUrl?: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Quote modal state
  const [quotePost, setQuotePost] = useState<ApiPost | null>(null)

  // Comment modal state
  const [commentPost, setCommentPost] = useState<any>(null)

  // Check auth + fetch current user + feed
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    authApi.me()
      .then((res) => {
        console.log('[Home] auth/me success:', res.data)
        setCurrentUser({ id: res.data.id, username: res.data.username, avatarUrl: res.data.avatarUrl })
        return postApi.getFeed()
      })
      .then((res) => {
        console.log('[Home] feed loaded, posts:', res.data.posts?.length)
        setPosts(res.data.posts)
      })
      .catch((err: any) => {
        console.error('[Home] Auth/Feed error:', err?.response?.status, err?.response?.data || err?.message || err)
        localStorage.removeItem('token')
        router.push('/login')
      })
      .finally(() => {
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchFeed = async () => {
    try {
      const res = await postApi.getFeed()
      setPosts(res.data.posts)
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/login')
      } else {
        setError('ไม่สามารถโหลด feed ได้')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePostCreated = () => {
    fetchFeed()
  }

  // ── Like (optimistic update) ─────────────────────────────────────────
  const handleLike = async (postId: string, optimisticLiked: boolean) => {
    const previousPosts = [...posts]

    // Optimistic update
    setPosts((current) =>
      current.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLiked: optimisticLiked,
              likesCount: optimisticLiked
                ? p.likesCount + 1
                : Math.max(0, p.likesCount - 1),
            }
          : p
      )
    )

    try {
      const res = await postApi.toggleLike(postId)
      setPosts((current) =>
        current.map((p) =>
          p.id === postId
            ? { ...p, isLiked: res.data.isLiked, likesCount: res.data.likesCount }
            : p
        )
      )
    } catch {
      setPosts(previousPosts)
    } finally {
      window.dispatchEvent(new CustomEvent('nexus:like-changed'))
    }
  }

  // ── Repost ─────────────────────────────────────────────────────────────
  const handleRepost = async (postId: string) => {
    const previousPosts = [...posts]
    const post = posts.find((p) => p.id === postId)
    if (!post) return

    const optimisticReposted = !post.isReposted

    setPosts((current) =>
      current.map((p) =>
        p.id === postId
          ? {
              ...p,
              isReposted: optimisticReposted,
              repostsCount: optimisticReposted
                ? p.repostsCount + 1
                : Math.max(0, p.repostsCount - 1),
            }
          : p
      )
    )

    try {
      let res: any
      if (post.isReposted) {
        res = await postApi.unrepost(postId)
      } else {
        res = await postApi.repost(postId)
      }
      setPosts((current) =>
        current.map((p) =>
          p.id === postId
            ? {
                ...p,
                isReposted: res.data.isReposted,
                repostsCount: res.data.repostsCount,
              }
            : p
        )
      )
    } catch {
      setPosts(previousPosts)
    }
  }

  // ── Quote: open modal ────────────────────────────────────────────────
  const handleQuote = (postId: string) => {
    const post = posts.find((p) => p.id === postId)
    if (post) setQuotePost(post)
  }

  // ── Quote: submit ───────────────────────────────────────────────────
  const handleQuoteSubmit = async (content: string) => {
    if (!quotePost) return

    const tempId = `temp-${Date.now()}`

    // Append quote post to feed optimistically
    const quoteData: ApiPost = {
      id: tempId,
      content,
      mediaUrls: [],
      likesCount: 0,
      repostsCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      isLiked: false,
      isReposted: false,
      isPinned: false,
      user: {
        id: currentUser?.id ?? '',
        username: currentUser?.username ?? '',
        displayName: currentUser?.username ?? '',
        avatarUrl: currentUser?.avatarUrl ?? null,
      },
      quotedPost: {
        id: quotePost.id,
        content: quotePost.content,
        mediaUrls: quotePost.mediaUrls,
        createdAt: quotePost.createdAt,
        user: {
          username: quotePost.user.username,
          displayName: quotePost.user.displayName,
          avatarUrl: quotePost.user.avatarUrl,
        },
      },
    }

    setPosts((current) => [quoteData, ...current])
    setQuotePost(null)

    try {
      const res = await postApi.quotePost(quotePost.id, content)
      // Replace temp with real data
      setPosts((current) =>
        current.map((p) => (p.id === tempId ? { ...res.data, id: res.data.id } : p))
      )
    } catch {
      // Remove temp on error
      setPosts((current) => current.filter((p) => p.id !== tempId))
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = async (postId: string) => {
    setPosts((current) => current.filter((p) => p.id !== postId))
    try {
      await postApi.deletePost(postId)
    } catch {
      fetchFeed()
    }
  }

  // ── Pin ────────────────────────────────────────────────────────────────
  const handlePin = async (postId: string) => {
    try {
      await postApi.pinPost(postId)
      fetchFeed()
    } catch {}
  }

  const handleUnpin = async (postId: string) => {
    try {
      await postApi.unpinPost(postId)
      fetchFeed()
    } catch {}
  }

  // ── Map API post → PostCard format ──────────────────────────────────
  const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url)
  const mapPost = (post: ApiPost) => {
    const imageUrls = (post.mediaUrls ?? []).filter((url: string) => !isVideo(url))
    return {
      id: post.id,
      user: {
        name: post.user.displayName || post.user.username,
        username: post.user.username,
        avatar: post.user.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${post.user.username}`,
      },
      content: post.content,
      images: imageUrls.length ? imageUrls : undefined,
      video: post.video,
      liked: post.isLiked ?? false,
      reposted: post.isReposted ?? false,
      isPinned: post.isPinned ?? false,
      time: timeAgo(post.createdAt),
      absoluteTime: formatAbsoluteTime(post.createdAt),
      stats: {
        comments: post.commentsCount,
        reposts: post.repostsCount,
        likes: post.likesCount,
        views: `${post.likesCount * 10}+`,
      },
      quotedPost: post.quotedPost
        ? {
            id: post.quotedPost.id,
            content: post.quotedPost.content,
            mediaUrls: post.quotedPost.mediaUrls,
            createdAt: post.quotedPost.createdAt,
            user: post.quotedPost.user,
          }
        : undefined,
      repostedBy: (post as any).repostedBy
        ? {
            id: (post as any).repostedBy.id,
            username: (post as any).repostedBy.username,
            displayName: (post as any).repostedBy.displayName || (post as any).repostedBy.username,
            avatar: (post as any).repostedBy.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${(post as any).repostedBy.username}`,
          }
        : undefined,
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map(i => <PostSkeleton key={i} />)}
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <span className="text-red-500">{error}</span>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      {/* Page header */}
      <div className="sticky top-16 z-40 bg-black/80 backdrop-blur-md px-4 h-14 flex items-center gap-8 border-b border-border">
        <h1 className="font-bold text-xl text-text-primary">Home</h1>
      </div>

      {/* Post Composer */}
      <PostComposer
        onPostCreated={handlePostCreated}
        avatarUrl={currentUser?.avatarUrl}
        username={currentUser?.username}
      />

      {/* Feed Posts */}
      <div className="divide-y divide-border">
        {posts.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            ไม่มีโพสต์เลย — ลองสร้างโพสต์แรกสิ!
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={mapPost(post)}
              rawPost={post}
              onLike={handleLike}
              onRepost={handleRepost}
              onQuote={handleQuote}
              onDelete={handleDelete}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onComment={setCommentPost}
              currentUsername={currentUser?.username}
              loggedInUsername={currentUser?.username}
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
              displayName: quotePost.user.displayName,
              avatarUrl: quotePost.user.avatarUrl,
            },
          }}
          onSubmit={handleQuoteSubmit}
          onClose={() => setQuotePost(null)}
        />
      )}

      {/* Comment Modal */}
      {commentPost && currentUser && (
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
            setPosts((current) =>
              current.map((p) =>
                p.id === commentPost.id
                  ? { ...p, commentsCount: p.commentsCount + 1 }
                  : p
              )
            )
          }}
          onCommentDeleted={() => {
            setPosts((current) =>
              current.map((p) =>
                p.id === commentPost.id
                  ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) }
                  : p
              )
            )
          }}
          currentUser={{
            id: currentUser.id,
            username: currentUser.username,
            displayName: '',
            avatarUrl: currentUser.avatarUrl ?? null,
          }}
        />
      )}
    </MainLayout>
  )
}
