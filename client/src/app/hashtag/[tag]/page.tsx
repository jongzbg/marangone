'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import PostCard from '@/components/posts/PostCard'
import QuoteModal from '@/components/posts/QuoteModal'
import CommentModal from '@/components/posts/CommentModal'
import { authApi, hashtagApi, postApi } from '@/lib/api'
import { formatAbsoluteTime } from '@/lib/format'
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

type Tab = 'popular' | 'latest' | 'following'

interface HashtagPageProps {
  params: { tag: string }
}

export default function HashtagPage({ params }: HashtagPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const decodedTag = decodeURIComponent(params.tag)

  const [posts, setPosts] = useState<ApiPost[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; avatarUrl?: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>((searchParams.get('type') as Tab) || 'latest')
  const [quotePost, setQuotePost] = useState<ApiPost | null>(null)
  const [commentPost, setCommentPost] = useState<any>(null)

  useEffect(() => {
    authApi.me()
      .then((res) => setCurrentUser({ id: res.data.id, username: res.data.username, avatarUrl: res.data.avatarUrl }))
      .catch(() => {})
      .finally(() => fetchPosts())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tag])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const res = await hashtagApi.getPosts(decodedTag, tab)
      setPosts(Array.isArray(res.data) ? res.data : (res.data?.posts || []))
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUser) fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handleTabChange = (t: Tab) => {
    setTab(t)
    router.push(`/hashtag/${encodeURIComponent(decodedTag)}?type=${t}`, { scroll: false })
  }

  const handleLike = async (postId: string, optimisticLiked: boolean) => {
    const previousPosts = [...posts]
    setPosts((current) =>
      current.map((p) =>
        p.id === postId
          ? { ...p, isLiked: optimisticLiked, likesCount: optimisticLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1) }
          : p
      )
    )
    try {
      const res = await postApi.toggleLike(postId)
      setPosts((current) =>
        current.map((p) => p.id === postId ? { ...p, isLiked: res.data.isLiked, likesCount: res.data.likesCount } : p)
      )
    } catch {
      setPosts(previousPosts)
    } finally {
      window.dispatchEvent(new CustomEvent('nexus:like-changed'))
    }
  }

  const handleRepost = async (postId: string) => {
    const previousPosts = [...posts]
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    const optimisticReposted = !post.isReposted
    setPosts((current) =>
      current.map((p) =>
        p.id === postId
          ? { ...p, isReposted: optimisticReposted, repostsCount: optimisticReposted ? p.repostsCount + 1 : Math.max(0, p.repostsCount - 1) }
          : p
      )
    )
    try {
      const res = await postApi.repost(postId)
      setPosts((current) =>
        current.map((p) => p.id === postId ? { ...p, isReposted: res.data.isReposted, repostsCount: res.data.repostsCount } : p)
      )
    } catch {
      setPosts(previousPosts)
    }
  }

  const handleQuote = (postId: string) => {
    const post = posts.find((p) => p.id === postId)
    if (post) setQuotePost(post)
  }

  const handleQuoteSubmit = async (content: string) => {
    if (!quotePost) return
    const tempId = `temp-${Date.now()}`
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
      user: { id: currentUser?.id ?? '', username: currentUser?.username ?? '', displayName: currentUser?.username ?? '', avatarUrl: currentUser?.avatarUrl ?? null },
      quotedPost: { id: quotePost.id, content: quotePost.content, mediaUrls: quotePost.mediaUrls, createdAt: quotePost.createdAt, user: { username: quotePost.user.username, displayName: quotePost.user.displayName, avatarUrl: quotePost.user.avatarUrl } },
    }
    setPosts((current) => [quoteData, ...current])
    setQuotePost(null)
    try {
      const res = await postApi.quotePost(quotePost.id, content)
      setPosts((current) => current.map((p) => p.id === tempId ? { ...res.data, id: res.data.id } : p))
    } catch {
      setPosts((current) => current.filter((p) => p.id !== tempId))
    }
  }

  const handleDelete = async (postId: string) => {
    setPosts((current) => current.filter((p) => p.id !== postId))
    try {
      await postApi.deletePost(postId)
    } catch {
      fetchPosts()
    }
  }

  const mapPost = (post: ApiPost) => {
    const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url)
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
        ? { id: post.quotedPost.id, content: post.quotedPost.content, mediaUrls: post.quotedPost.mediaUrls, createdAt: post.quotedPost.createdAt, user: post.quotedPost.user }
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

  return (
    <MainLayout>
      {/* Page header */}
      <div className="sticky top-16 z-40 bg-black/80 backdrop-blur-md px-4 h-14 flex items-center gap-8 border-b border-border">
        <h1 className="font-bold text-xl text-text-primary">#{decodedTag}</h1>
      </div>

      {/* Tabs */}
      <div className="sticky top-[72px] z-30 bg-black/90 backdrop-blur-md flex border-b border-border">
        {(['popular', 'latest', 'following'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`flex-1 py-4 text-sm font-medium text-center transition-colors relative ${
              tab === t ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {tab === t && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="divide-y divide-border">
        {loading ? (
          [1, 2, 3, 4, 5].map(i => <PostSkeleton key={i} />)
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-text-muted">ไม่มีโพสต์ที่เกี่ยวกับ #{decodedTag} เลย</div>
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
          onCommentAdded={() => {}}
          onCommentDeleted={() => {}}
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