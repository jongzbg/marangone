'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import ProfileHeader from '@/components/profile/ProfileHeader'
import FollowListModal from '@/components/profile/FollowListModal'
import PostComposer from '@/components/posts/PostComposer'
import PostCard from '@/components/posts/PostCard'
import QuoteModal from '@/components/posts/QuoteModal'
import CommentModal from '@/components/posts/CommentModal'
import { ProfileHeaderSkeleton, PostComposerSkeleton, PostSkeleton } from '@/components/Skeleton'
import { userApi, postApi, authApi } from '@/lib/api'
import { chatApi } from '@/lib/chatApi'
import { formatAbsoluteTime } from '@/lib/format'

type Tab = 'posts' | 'likes'

interface ProfileData {
  id: string
  username: string
  name: string
  displayName: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  bio: string | null
  location: string | null
  website: string | null
  createdAt: string
  followersCount: number
  followingCount: number
  postsCount: number
  likesCount: number
  likesTodayCount: number
  isFollowing?: boolean
}

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

interface PostData {
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
    displayName: string | null
    avatarUrl: string | null
  }
  parentPost?: {
    id: string
    content: string
    user: { username: string; displayName: string; avatarUrl: string | null }
  }
  repostedBy?: {
    id: string
    username: string
    displayName?: string | null
    avatarUrl?: string | null
  }
  quotedPost?: {
    id: string
    content: string
    mediaUrls?: string[]
    createdAt?: string
    user: { username: string; displayName?: string; avatarUrl?: string | null }
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

export default function ProfilePage() {
  const router = useRouter()
  const routeParams = useParams<{ username: string }>()
  const username = typeof routeParams.username === 'string' ? routeParams.username : ''
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [posts, setPosts] = useState<PostData[]>([])
  const [likes, setLikes] = useState<PostData[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null)
  const [loggedInAvatar, setLoggedInAvatar] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('profileTab') as Tab) || 'posts'
    }
    return 'posts'
  })
  const [quotePost, setQuotePost] = useState<PostData | null>(null)
  const [commentPost, setCommentPost] = useState<any>(null)
  const [followListTab, setFollowListTab] = useState<'followers' | 'following' | null>(null)

  // ── Load profile on mount ────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    authApi.me()
      .then((res) => { setCurrentUserId(res.data.id); setLoggedInUsername(res.data.username); setLoggedInAvatar(res.data.avatarUrl ?? '') })
      .catch(() => {})

    userApi.getProfile(username)
      .then((res) => setProfile(res.data))
      .catch((err) => {
        if (err.response?.status === 404) setError('User not found')
        else setError('Failed to load profile')
      })
      .finally(() => setLoading(false))

    postApi.getUserPosts(username).then((res) => setPosts(res.data.posts || []))
    postApi.getUserLikedPosts(username).then((res) => setLikes(res.data.posts || []))
  }, [username])

  // ── Tab switch ────────────────────────────────────────────────────────────
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    localStorage.setItem('profileTab', tab)
    if (tab === 'posts' && posts.length === 0) {
      postApi.getUserPosts(username).then((res) => setPosts(res.data.posts || []))
    } else if (tab === 'likes' && likes.length === 0) {
      postApi.getUserLikedPosts(username).then((res) => setLikes(res.data.posts || []))
    }
  }

  // ── Follow ────────────────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!profile) return
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }

    try {
      if (profile.isFollowing) {
        await userApi.unfollow(profile.id)
        setProfile({ ...profile, isFollowing: false, followersCount: profile.followersCount - 1 })
      } else {
        await userApi.follow(profile.id)
        setProfile({ ...profile, isFollowing: true, followersCount: profile.followersCount + 1 })
      }
    } catch {}
  }

  // ── Like ──────────────────────────────────────────────────────────────────
  const handleLike = async (postId: string, optimisticLiked: boolean) => {
    console.log('[ProfilePage] handleLike called, postId:', postId, 'optimisticLiked:', optimisticLiked);
    // Optimistic update on BOTH tabs simultaneously
    const update = (list: PostData[]) =>
      list.map((p) =>
        p.id === postId
          ? { ...p, isLiked: optimisticLiked, likesCount: optimisticLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1) }
          : p
      )

    setPosts((prev) => update(prev))
    setLikes((prev) => {
      const updated = update(prev)
      // Remove from Likes tab after confirmed unlike from server
      if (!optimisticLiked) return updated.filter((p) => p.id !== postId)
      return updated
    })

    try {
      const res = await postApi.toggleLike(postId)
      console.log('[ProfilePage] toggleLike response:', res.data);
      const sync = (list: PostData[]) =>
        list.map((p) => p.id === postId ? { ...p, isLiked: res.data.isLiked, likesCount: res.data.likesCount } : p)

      setPosts((prev) => sync(prev))
      setLikes((prev) => {
        if (!res.data.isLiked) return prev.filter((p) => p.id !== postId)
        // Add to Likes tab if not already present (server confirmed the like)
        if (!prev.find((p) => p.id === postId)) {
          // Look up the post AFTER posts state has been synced
          const postInPosts = posts.find((p) => p.id === postId)
          if (postInPosts) {
            const syncedPost = { ...postInPosts, isLiked: res.data.isLiked, likesCount: res.data.likesCount }
            return [syncedPost, ...prev]
          }
        }
        return prev.map((p) => p.id === postId ? { ...p, isLiked: res.data.isLiked, likesCount: res.data.likesCount } : p)
      })

      // Sync profile header likes count — update when liking/unliking own posts
      setProfile((prev) => {
        if (!prev) return prev
        const postInPosts = posts.find((p) => p.id === postId)
        const isOwnPost = postInPosts?.user.id === prev.id
        if (!isOwnPost) return prev

        // Check if post was created today for likesTodayCount
        const isToday = postInPosts && new Date(postInPosts.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)

        if (res.data.isLiked) {
          // Liking: increment both counts
          return {
            ...prev,
            likesCount: prev.likesCount + 1,
            likesTodayCount: isToday ? prev.likesTodayCount + 1 : prev.likesTodayCount,
          }
        } else {
          // Unliking: decrement both counts
          return {
            ...prev,
            likesCount: Math.max(0, prev.likesCount - 1),
            likesTodayCount: isToday ? Math.max(0, prev.likesTodayCount - 1) : prev.likesTodayCount,
          }
        }
      })

      window.dispatchEvent(new CustomEvent('nexus:like-changed'))
    } catch (err) {
      console.error('[ProfilePage] toggleLike error:', err);
    }
  }

  // ── Repost ────────────────────────────────────────────────────────────────
  const handleRepost = async (postId: string) => {
    const list = activeTab === 'posts' ? posts : likes
    const post = list.find((p) => p.id === postId)
    if (!post) return

    const optimisticReposted = !post.isReposted
    const update = (arr: PostData[]) =>
      arr.map((p) =>
        p.id === postId
          ? { ...p, isReposted: optimisticReposted, repostsCount: optimisticReposted ? p.repostsCount + 1 : Math.max(0, p.repostsCount - 1) }
          : p
      )

    const setFn = activeTab === 'posts' ? setPosts : setLikes
    // Optimistic update
    setFn(update)

    try {
      const res = post.isReposted
        ? await postApi.unrepost(postId)
        : await postApi.repost(postId)
      // Sync with server response using functional update to avoid stale closure
      setFn((prev) => {
        const synced = prev.map((p) =>
          p.id === postId ? { ...p, isReposted: res.data.isReposted, repostsCount: res.data.repostsCount } : p
        )
        // Remove from Tab Posts if isReposted is now false
        return activeTab === 'posts'
          ? synced.filter((p) => !(p.id === postId && !p.isReposted))
          : synced
      })
    } catch {}
  }

  // ── Quote ──────────────────────────────────────────────────────────────────
  const handleQuote = (postId: string) => {
    const list = activeTab === 'posts' ? posts : likes
    const post = list.find((p) => p.id === postId)
    if (post) setQuotePost(post)
  }

  const handleQuoteSubmit = async (content: string) => {
    if (!quotePost) return
    const tempId = `temp-${Date.now()}`
    const quoteData: PostData = {
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
      user: { id: currentUserId ?? '', username: username, displayName: username, avatarUrl: null },
      quotedPost: {
        id: quotePost.id,
        content: quotePost.content,
        mediaUrls: quotePost.mediaUrls,
        createdAt: quotePost.createdAt,
        user: { username: quotePost.user.username, displayName: quotePost.user.displayName ?? quotePost.user.username, avatarUrl: quotePost.user.avatarUrl },
      },
    }
    setPosts((current) => [quoteData, ...current])
    setQuotePost(null)
    try {
      const res = await postApi.quotePost(quotePost.id, content)
      setPosts((current) => current.map((p) => (p.id === tempId ? { ...res.data, id: res.data.id } : p)))
    } catch {
      setPosts((current) => current.filter((p) => p.id !== tempId))
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (postId: string) => {
    setPosts((current) => current.filter((p) => p.id !== postId))
    if (profile) setProfile({ ...profile, postsCount: Math.max(0, profile.postsCount - 1) })
    try {
      await postApi.deletePost(postId)
    } catch {}
  }

  // ── Pin ───────────────────────────────────────────────────────────────────
  const handlePin = async (postId: string) => {
    try {
      await postApi.pinPost(postId)
      const res = await postApi.getUserPosts(username)
      setPosts(res.data.posts || [])
    } catch {}
  }

  const handleUnpin = async (postId: string) => {
    try {
      await postApi.unpinPost(postId)
      const res = await postApi.getUserPosts(username)
      setPosts(res.data.posts || [])
    } catch {}
  }

  // ── New post ──────────────────────────────────────────────────────────────
  const handlePostCreated = () => {
    if (!profile) return
    setProfile({ ...profile, postsCount: profile.postsCount + 1 })
    if (activeTab !== 'posts') {
      setActiveTab('posts')
      localStorage.setItem('profileTab', 'posts')
    }
    const res = postApi.getUserPosts(username)
    res.then((r) => setPosts(r.data.posts || []))
  }

  if (loading) {
    return (
      <MainLayout>
        <ProfileHeaderSkeleton />
        <div className="divide-y divide-border">
          <PostComposerSkeleton />
          {[1, 2, 3, 4, 5].map(i => <PostSkeleton key={i} />)}
        </div>
      </MainLayout>
    )
  }

  if (error || !profile) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <span className="text-red-500">{error || 'User not found'}</span>
        </div>
      </MainLayout>
    )
  }

  const isOwnProfile = currentUserId === profile.id
  const currentPosts = (activeTab === 'posts' ? posts : likes).slice().sort((a, b) =>
    (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
  )

  const mapPost = (post: PostData) => {
    const avatar = post.user.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${post.user.username}`
    const displayName = post.user.displayName || post.user.username
    const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url)
    const imageUrls = (post.mediaUrls ?? []).filter((url: string) => !isVideo(url))

    return {
      id: post.id,
      user: { name: displayName, username: post.user.username, avatar },
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
      quotedPost: post.quotedPost,
      repostedBy: post.repostedBy ? {
        id: post.repostedBy.id,
        username: post.repostedBy.username,
        displayName: post.repostedBy.displayName || post.repostedBy.username,
        avatar: post.repostedBy.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${post.repostedBy.username}`,
      } : undefined,
    }
  }

  const joinedDate = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const tabClasses = (tab: Tab) =>
    `flex-1 py-3 text-sm font-bold text-center hover:bg-white/5 transition-colors border-b-2 ${
      activeTab === tab
        ? 'border-primary text-primary'
        : 'border-transparent text-text-muted'
    }`

  // ── Message ─────────────────────────────────────────────────────────────────
  const handleMessage = () => {
    if (!profile) return
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    chatApi.createConversation(profile.id)
      .then(res => router.push(`/messages/${res.data.id}`))
      .catch(() => {})
  }

  const handleFollowersClick = () => setFollowListTab('followers')
  const handleFollowingClick = () => setFollowListTab('following')
  const handleFollowListClose = () => setFollowListTab(null)

  return (
    <MainLayout>
      <ProfileHeader
        user={{
          id: profile.id,
          name: profile.displayName || profile.name,
          username: profile.username,
          bio: profile.bio || '',
          location: profile.location || undefined,
          website: profile.website || undefined,
          joinedDate,
          followers: profile.followersCount,
          following: profile.followingCount,
          likes: profile.likesCount,
          likesToday: profile.likesTodayCount,
          avatar: profile.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.username}`,
          banner: profile.bannerUrl || '',
          isFollowing: profile.isFollowing,
        }}
        isOwnProfile={isOwnProfile}
        onFollow={handleFollow}
        onMessage={handleMessage}
        onFollowersClick={handleFollowersClick}
        onFollowingClick={handleFollowingClick}
      />

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button onClick={() => handleTabChange('posts')} className={tabClasses('posts')}>
          Posts
        </button>
        <button onClick={() => handleTabChange('likes')} className={tabClasses('likes')}>
          Likes
        </button>
      </div>

      {/* Post Composer — only on own profile */}
      {isOwnProfile && activeTab === 'posts' && (
        <PostComposer
          onPostCreated={handlePostCreated}
          avatarUrl={profile.avatarUrl}
          username={profile.username}
        />
      )}

      {/* Posts list */}
      <div className="divide-y divide-border">
        {currentPosts.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            {activeTab === 'posts' && 'ไม่มีโพสต์เลย'}
            {activeTab === 'likes' && 'ยังไม่ได้ like โพสต์ใดเลย'}
          </div>
        ) : (
          currentPosts.map((post) => (
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
              currentUsername={username}
              loggedInUsername={loggedInUsername ?? undefined}
              loggedInAvatar={loggedInAvatar}
              showRepostBanner
              showPinButton={isOwnProfile && activeTab === 'posts'}
              showPinBadge={isOwnProfile && activeTab === 'posts'}
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
            // Refresh the post's comment count in both tabs
            postApi.getUserPosts(username).then((res) => setPosts(res.data.posts || []))
            postApi.getUserLikedPosts(username).then((res) => setLikes(res.data.posts || []))
          }}
          onCommentDeleted={() => {
            // Refresh the post's comment count in both tabs
            postApi.getUserPosts(username).then((res) => setPosts(res.data.posts || []))
            postApi.getUserLikedPosts(username).then((res) => setLikes(res.data.posts || []))
          }}
          currentUser={{
            id: currentUserId,
            username: username,
            displayName: profile.displayName || profile.name,
            avatarUrl: profile.avatarUrl,
          }}
        />
      )}

      {followListTab && profile && (
        <FollowListModal
          username={profile.username}
          initialTab={followListTab}
          currentUserId={currentUserId || ''}
          onClose={handleFollowListClose}
          onFollowChanged={() => {
            userApi.getProfile(username).then(res => {
              setProfile({ ...profile, ...res.data, followersCount: res.data.followersCount, followingCount: res.data.followingCount, isFollowing: res.data.isFollowing })
            })
          }}
        />
      )}
    </MainLayout>
  )
}
