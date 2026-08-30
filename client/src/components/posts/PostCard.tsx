'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lightbox } from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import PostActions from './PostActions'
import PostDropdown from './PostDropdown'
import UserHoverTrigger from '@/components/UserHoverTrigger'
import { useVideoReady } from '@/hooks/useVideoReady'
import { timeAgo } from '@/lib/format'

// Pattern order: @mentions, #hashtags, URLs
function parseContent(content: string): React.ReactNode[] {
  const parts = content.split(/(@[\wก-๙]+)|(#[฀-๿\w]+)|(https?:\/\/[^\s]+)/g)
  return parts.map((part, i) => {
    if (!part) return part

    // @mention
    if (part.startsWith('@')) {
      const username = part.slice(1)
      return (
        <Link
          key={i}
          href={`/profile/${username}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      )
    }

    // #hashtag
    if (part.startsWith('#')) {
      const tag = part.slice(1)
      return (
        <Link
          key={i}
          href={`/hashtag/${tag}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      )
    }

    // External URL
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }

    return part
  })
}

// Format seconds → "m:ss" or "h:mm:ss"
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Post {
  id: string
  user: {
    name: string
    username: string
    avatar: string
  }
  content: string
  image?: string
  /** Image URLs only — video URLs filtered out by mapPost(). Use this for rendering. */
  images?: string[]
  /** Video — comes from API as post.video, not from mediaUrls */
  video?: {
    id: string
    status: 'pending' | 'processing' | 'ready' | 'failed'
    videoUrl?: string
    thumbnailUrl?: string
    duration?: number
    error?: string
    resolutions?: string[]
    encodingProfile?: string
    /** Internal: set to true when user clicks play to replace thumbnail with <video> */
    _playing?: boolean
  }
  /** Raw media URLs from backend (images + video files). Prefer using post.images for rendering. */
  mediaUrls?: string[]
  time: string
  /** Full ISO timestamp — shown on hover as tooltip (e.g. "22:00 · 5 พ.ค. 2569") */
  absoluteTime?: string
  stats: {
    comments: number | string
    reposts: number | string
    likes: number | string
    views: string
  }
  liked?: boolean
  reposted?: boolean
  isPinned?: boolean
  // Repost metadata — when viewing a reposted post
  repostedBy?: { id: string; username: string; displayName?: string; avatar?: string }
  // Original post when this IS a quote
  quotedPost?: {
    id: string
    content: string
    mediaUrls?: string[]
    createdAt?: string
    user: { username: string; displayName?: string; avatarUrl?: string | null }
  }
}

interface PostCardProps {
  post: Post
  /** Raw API post — passed through to onComment so CommentModal can access user.id */
  rawPost?: any
  onLike?: (postId: string, liked: boolean) => void
  onRepost?: (postId: string) => void
  onQuote?: (postId: string) => void
  onDelete?: (postId: string) => void
  onPin?: (postId: string) => void
  onUnpin?: (postId: string) => void
  onComment?: (post: any) => void
  /** Custom click handler. If not provided, PostCard navigates to /posts/:id */
  onClick?: (e: React.MouseEvent) => void
  currentUsername?: string
  /** Username ของคนที่กำลัง login — ใช้เทียบ "You reposted" */
  loggedInUsername?: string
  /** Avatar ของคนที่กำลัง login — ใช้ hover card ใน "You reposted" banner */
  loggedInAvatar?: string
  /** Show pin/unpin button in dropdown — only on profile page for own posts */
  showPinButton?: boolean
  /** Show 📌 badge — only on profile page */
  showPinBadge?: boolean
  /** Show repost banner — only on profile page */
  showRepostBanner?: boolean
}

export default function PostCard({ post, rawPost, onLike, onRepost, onQuote, onDelete, onPin, onUnpin, onComment, onClick, currentUsername, loggedInUsername, loggedInAvatar, showPinButton = false, showPinBadge = false, showRepostBanner = false }: PostCardProps) {
  const liked = post.liked ?? false
  const reposted = post.reposted ?? false
  const isPinned = post.isPinned ?? false
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const buttonRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hiddenVideoRef = useRef<HTMLVideoElement>(null)
  const router = useRouter()
  const isOwnPost = currentUsername === post.user.username
  const likeCount =
    typeof post.stats.likes === 'number'
      ? post.stats.likes
      : parseInt(post.stats.likes.toString().replace(/[^0-9]/g, '')) * 1000

// ── Unified Media Grid: merge video + images ──────────────────────────────
  // post.images contains the image URLs (video URLs already filtered out by mapPost)
  // post.video carries the encoding state (status, thumbnailUrl, videoUrl, etc.)

  const allMedia: Array<{ type: 'video' | 'image'; url: string; index: number }> = []

  if (post.images) {
    post.images.forEach((url, i) => {
      allMedia.push({ type: 'image', url, index: i })
    })
  }

  // Render media item by grid position (not by type)
  const renderMediaItem = (item: typeof allMedia[0], gridArea?: string) => {
    if (item.type === 'video') {
      return (
        <div className="relative overflow-hidden bg-neutral-900 group cursor-pointer w-full h-full" style={gridArea ? { gridArea } : {}} onClick={(e) => { e.stopPropagation(); handleVideoClick(e as any) }}>
          {/* Thumbnail / pending / failed states */}
          {videoData?.status === 'pending' || videoData?.status === 'processing' ? (
            <div className="w-full h-full flex items-center justify-center relative">
              {videoData.thumbnailUrl ? (
                <img src={`${API_URL}/videos/${videoData.id}/thumb.jpg`} alt="Video thumbnail" className="w-full h-full object-cover opacity-60" />
              ) : (
                <span className="material-symbols-outlined text-5xl text-text-muted animate-pulse">videocam</span>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-4xl text-white animate-pulse">hourglass_empty</span>
                <span className="text-text-muted text-sm">{videoData.status === 'pending' ? 'กำลังเตรียมวิดีโอ...' : 'กำลังประมวลผล...'}</span>
              </div>
            </div>
          ) : videoData?.status === 'failed' ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-4xl text-red-400">error</span>
              <span className="text-red-400 text-sm">อัปโหลดวิดีโอไม่สำเร็จ</span>
            </div>
          ) : videoData?.status === 'ready' && videoData.videoUrl ? (
            <>
              <video
                ref={videoRef}
                src={`${API_URL}${videoData.videoUrl}`}
                preload="none"
                muted={isMuted}
                playsInline
                loop={false}
                className="w-full h-full object-cover"
                onTimeUpdate={() => videoRef.current && setVideoCurrentTime(videoRef.current.currentTime)}
                onEnded={() => setVideoPaused(true)}
              />
              {videoPaused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-14 h-14 rounded-full bg-white/80 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-black">play_arrow</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-12 bg-gradient-to-t from-black/70 to-transparent">
                <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-white rounded-full" style={{ width: videoData.duration ? `${(videoCurrentTime / videoData.duration) * 100}%` : '0%' }} />
                </div>
                <span className="text-white text-xs tabular-nums">
                  {formatDuration(Math.floor(videoCurrentTime))} / {formatDuration(videoData.duration || 0)}
                </span>
              </div>
            </>
          ) : null}
        </div>
      )
    } else {
      const lightboxIdx = allMedia.filter(m => m.type === 'image').findIndex(m => m.url === item.url)
      return (
        <div className="relative overflow-hidden cursor-pointer w-full h-full" style={gridArea ? { gridArea } : {}} onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIdx) }}>
          <img alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" src={item.url} />
        </div>
      )
    }
  }

  // ── Layout by file count ───────────────────────────────────────────────
  const totalMedia = allMedia.length
  const mediaImages = allMedia.filter(m => m.type === 'image').map(m => m.url)
  // Legacy: no longer stores videos in mediaUrls (all video goes to post.video now)
  const mediaVideos: string[] = []

  // Separate renders for clarity (keep existing single-media and all-images blocks)
  // Only use unified grid for mixed video+images
  const hasDedicatedVideo = !!post.video
  const hasImages = allMedia.some(m => m.type === 'image')

  // ── Video poll state (for posts with pending/processing video) ─────────────
  const [videoData, setVideoData] = useState(post.video)
  const [videoPaused, setVideoPaused] = useState(true)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsExpandedSection, setSettingsExpandedSection] = useState<string | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)

  // ── Click-to-play handler for hybrid video+image layout ──────────────────
  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    if (videoPaused) {
      videoRef.current.play().catch(() => {})
      setVideoPaused(false)
    } else {
      videoRef.current.pause()
      setVideoPaused(true)
    }
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  // Helper to render video controls bar (used in both thumbnail and playing states)
  const VideoControlsBar = ({ isPlaying, isThumbnail }: { isPlaying: boolean; isThumbnail: boolean }) => {
    if (!videoData) return null
    return (
    <div
      data-video-controls
      className={`absolute bottom-0 left-0 right-0 flex flex-col gap-1 px-3 pb-3 pt-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress bar */}
      <div
        className="w-full h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer pointer-events-auto"
        onClick={(e) => {
          e.stopPropagation()
          if (!videoRef.current || isThumbnail) return
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          videoRef.current.currentTime = ratio * videoRef.current.duration
        }}
      >
        <div
          className="h-full bg-white rounded-full"
          style={{ width: videoData.duration ? `${(videoCurrentTime / videoData.duration) * 100}%` : '0%' }}
        />
      </div>
      {/* Control buttons row */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Play/Pause */}
        <button
          data-no-nav
          className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            if (!videoRef.current) return
            if (isThumbnail) {
              setVideoData((prev) => prev ? { ...prev, _playing: true } : prev)
            } else {
              if (videoRef.current.paused) {
                videoRef.current.play()
              } else {
                videoRef.current.pause()
              }
            }
          }}
        >
          <span className="material-symbols-outlined text-white text-lg">
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        {/* Current time / Duration */}
        <span className="text-white text-xs tabular-nums">
          {formatDuration(Math.floor(videoCurrentTime))} / {formatDuration(videoData.duration || 0)}
        </span>

        <div className="flex-1" />

        {/* Volume */}
        <button
          data-no-nav
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            if (!videoRef.current) return
            if (videoRef.current.muted || videoRef.current.volume === 0) {
              videoRef.current.muted = false
              videoRef.current.volume = 1
              setIsMuted(false)
            } else {
              videoRef.current.muted = true
              setIsMuted(true)
            }
          }}
        >
          <span className="material-symbols-outlined text-white text-lg">
            {isMuted || !videoRef.current?.volume ? 'volume_off' : 'volume_up'}
          </span>
        </button>

        {/* Fullscreen */}
        <button
          data-no-nav
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            const container = videoRef.current?.parentElement
            if (!container) return
            if (document.fullscreenElement) {
              document.exitFullscreen()
            } else {
              container.requestFullscreen()
            }
          }}
        >
          <span className="material-symbols-outlined text-white text-lg">fullscreen</span>
        </button>
      </div>
    </div>
  )
  }

  // ── useVideoReady: Socket.IO + SSE + HTTP polling fallback ───────────────────
  const videoId = post.video?.id ?? null
  const videoReadyPayload = useVideoReady(videoId)

  // Sync hook result → local videoData state
  useEffect(() => {
    if (!videoReadyPayload) return
    const { videoId: _vid, status, videoUrl, thumbnailUrl, resolutions, encodingProfile, error } = videoReadyPayload
    setVideoData((prev) => ({
      ...prev!,
      status,
      videoUrl: videoUrl ?? prev?.videoUrl,
      thumbnailUrl: thumbnailUrl ?? prev?.thumbnailUrl,
      resolutions: resolutions ?? prev?.resolutions,
      encodingProfile: encodingProfile ?? prev?.encodingProfile,
      error,
    }))
  }, [videoReadyPayload])

  // ── Auto-play when _playing is set ───────────────────────────────────────
  useEffect(() => {
    if (videoData?._playing && videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }, [videoData?._playing])

  const openLightbox = (index: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setLightboxIndex(index)
  }

  const closeLightbox = () => setLightboxIndex(null)

  const handleLike = () => {
    onLike?.(post.id, !liked)
  }

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (
      target.closest('a') ||
      target.closest('button') ||
      target.closest('[data-no-nav]')
    ) return
    if (window.getSelection()?.toString().length) return
    if (onClick) {
      onClick(e)
    } else {
      router.push(`/posts/${post.id}`)
    }
  }

  return (
    <>
      <article
        onClick={handleClick}
        className="p-4 border-b border-border hover:bg-[#16181c]/50 transition-colors cursor-pointer"
      >
        {/* Reposted by banner — only show on profile page */}
        {showRepostBanner && post.repostedBy && (
          <div className="flex items-center gap-1.5 mb-1 ml-12 text-text-muted text-sm">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>repeat</span>
            <span>
              {post.repostedBy.username === loggedInUsername ? (
                loggedInAvatar ? (
                  <UserHoverTrigger
                    username={loggedInUsername ?? ''}
                    avatar={loggedInAvatar}
                    className="inline"
                  >
                    <span>You reposted</span>
                  </UserHoverTrigger>
                ) : (
                  <span>You reposted</span>
                )
              ) : (
                <>
                  <UserHoverTrigger
                    username={post.repostedBy.username}
                    avatar={post.repostedBy.avatar ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${post.repostedBy.username}`}
                    className="inline"
                  >
                    <Link
                      href={`/profile/${post.repostedBy.username}`}
                      className="hover:underline font-medium"
                    >
                      {post.repostedBy.displayName || `@${post.repostedBy.username}`}
                    </Link>
                  </UserHoverTrigger>
                  {' '}reposted
                </>
              )}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          {/* Avatar — hover trigger */}
          <UserHoverTrigger
            username={post.user.username}
            avatar={post.user.avatar}
            className="shrink-0 w-10 h-10"
          >
            <Link
              href={`/profile/${post.user.username}`}
              className="w-10 h-10 block rounded-full hover:opacity-80 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                alt={post.user.name}
                className="w-10 h-10 rounded-full hover:opacity-80 transition-opacity"
                src={post.user.avatar}
              />
            </Link>
          </UserHoverTrigger>

          {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            {/* Name + username + time — all in one flex row */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Name + username wrapped with hover — time stays outside trigger */}
              <UserHoverTrigger
                username={post.user.username}
                avatar={post.user.avatar}
                className="min-w-0"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <Link
                    href={`/profile/${post.user.username}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="font-bold text-text-primary truncate">
                      {post.user.name}
                    </span>
                  </Link>
                  {showPinBadge && isPinned && (
                    <span className="text-[#1D9BF0] text-sm font-medium shrink-0" title="ปักหมุดแล้ว">📌</span>
                  )}
                  <Link
                    href={`/profile/${post.user.username}`}
                    className="text-text-muted truncate hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @{post.user.username}
                  </Link>
                </div>
              </UserHoverTrigger>
              <span className="text-text-muted shrink-0">·</span>
              {/* Time — stays on same line, outside hover trigger */}
              <span className="text-text-muted shrink-0 whitespace-nowrap relative group/time">
                <span className="hidden group-hover/time:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap z-50">
                  {post.absoluteTime}
                </span>
                <Link
                  href={`/posts/${post.id}`}
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {post.time}
                </Link>
              </span>
            </div>

            {/* ... dropdown — for own posts, or profile owner with pin */}
            {(isOwnPost || showPinButton) && (
              <div ref={buttonRef} className="relative shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setDropdownOpen((prev) => !prev)
                  }}
                  className="p-1.5 rounded-full hover:bg-[#1D9BF0]/20 text-text-muted hover:text-[#1D9BF0] transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">more_horiz</span>
                </button>
                {dropdownOpen && (
                  <PostDropdown
                    postId={post.id}
                    isPinned={isPinned}
                    showPinButton={showPinButton}
                    onDelete={onDelete ?? (() => {})}
                    onPin={onPin ?? (() => {})}
                    onUnpin={onUnpin ?? (() => {})}
                    onClose={() => setDropdownOpen(false)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Text */}
          <p className="text-text-primary mt-1 leading-relaxed">{useMemo(() => parseContent(post.content), [post.content])}</p>

          {/* Quoted/Embedded Post */}
          {post.quotedPost && (
            <div
              className="mt-3 border border-border rounded-xl p-3 hover:bg-white/5 transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); router.push(`/posts/${post.quotedPost!.id}`) }}
            >
              <div className="flex items-start gap-2">
                <Link
                  href={`/profile/${post.quotedPost.user.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 w-8 h-8"
                >
                  <img
                    src={
                      post.quotedPost.user.avatarUrl ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${post.quotedPost.user.username}`
                    }
                    alt={post.quotedPost.user.displayName || post.quotedPost.user.username}
                    className="w-8 h-8 rounded-full"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/profile/${post.quotedPost.user.username}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      <span className="font-bold text-text-primary text-sm">
                        {post.quotedPost.user.displayName || post.quotedPost.user.username}
                      </span>
                      <span className="text-text-muted text-sm ml-1">
                        @{post.quotedPost.user.username}
                      </span>
                    </Link>
                    {post.quotedPost.createdAt && (
                      <span className="text-text-muted text-sm ml-1">
                        · {timeAgo(post.quotedPost.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-text-primary text-sm mt-1 break-words">
                    {useMemo(() => parseContent(post.quotedPost!.content), [post.quotedPost!.content])}
                  </p>
                  {post.quotedPost.mediaUrls && post.quotedPost.mediaUrls.length > 0 && (() => {
                    const urls = post.quotedPost!.mediaUrls!
                    return (
                    <div
                      className="mt-2 grid gap-0.5 rounded-xl overflow-hidden border border-border"
                      style={{
                        gridTemplateColumns: urls.length === 1 ? '1fr' : '1fr 1fr',
                        gridTemplateRows: urls.length === 1 ? '1fr' : '1fr 1fr',
                        maxHeight: urls.length === 1 ? '250px' : '200px',
                      }}
                    >
                      {urls.slice(0, 4).map((url, idx) => (
                        <div
                          key={idx}
                          className="overflow-hidden bg-neutral-900 relative"
                          style={{
                            gridColumn: urls.length === 3 && idx === 0 ? '1 / 2' : undefined,
                            gridRow: urls.length === 3 && idx === 0 ? '1 / 3' : undefined,
                          }}
                        >
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover"
                            style={{ minHeight: '80px', maxHeight: urls.length === 1 ? '250px' : '97px' }}
                          />
                          {idx === 3 && urls.length > 4 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xl font-bold">
                              +{urls.length - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}
          {/* ── Unified Media Grid — mixed video + images (2+ files with a video) ─── */}
          {/* Only show when we have a video — images-only falls through to Gallery Grid below */}
          {hasDedicatedVideo && totalMedia >= 2 && (
            <div className="block mt-3 rounded-2xl overflow-hidden border border-border" style={{ maxHeight: '400px' }}>
              {/* ── 2 files: side-by-side, each 400px tall ── */}
              {totalMedia === 2 && (
                <div className="grid grid-cols-2 gap-0.5" style={{ height: '400px' }}>
                  {allMedia.map((item, i) => (
                    <div key={i} className="relative overflow-hidden bg-neutral-900" style={{ height: '400px' }}>
                      {renderMediaItem(item)}
                    </div>
                  ))}
                </div>
              )}

              {/* ── 3 files: 1 top-left, 1 top-right, 1 bottom-right ── */}
              {totalMedia === 3 && (
                <div className="grid grid-cols-2 grid-rows-2 gap-0.5" style={{ height: '400px' }}>
                  {/* File 1: top-left */}
                  <div className="relative overflow-hidden bg-neutral-900 row-span-1" style={{ height: '200px' }}>
                    {renderMediaItem(allMedia[0])}
                  </div>
                  {/* File 2: top-right */}
                  <div className="relative overflow-hidden bg-neutral-900 row-span-1" style={{ height: '200px' }}>
                    {renderMediaItem(allMedia[1])}
                  </div>
                  {/* File 3: bottom-right */}
                  <div className="relative overflow-hidden row-span-1" style={{ height: '200px' }}>
                    {renderMediaItem(allMedia[2])}
                  </div>
                </div>
              )}

              {/* ── 4 files: 2x2 grid, each 200px tall ── */}
              {totalMedia === 4 && (
                <div className="grid grid-cols-2 gap-0.5" style={{ height: '400px' }}>
                  {allMedia.map((item, i) => (
                    <div key={i} className="relative overflow-hidden bg-neutral-900" style={{ height: '200px' }}>
                      {renderMediaItem(item)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Gallery Grid — 3 images: 1 large left + 2 stacked right (images-only, no video) */}
          {!hasDedicatedVideo && mediaImages.length === 3 && (
            <div
              className="block mt-3 rounded-2xl overflow-hidden border border-border cursor-pointer"
              style={{ maxHeight: '400px' }}
              onClick={handleClick}
            >
              <div className="flex gap-0.5" style={{ height: '400px' }}>
                {/* Left: big image */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <img
                    alt=""
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    src={mediaImages[0]}
                    onClick={openLightbox(0)}
                  />
                </div>
                {/* Right: 2 stacked */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex-1 overflow-hidden">
                      <img
                        alt=""
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        src={mediaImages[i]}
                        onClick={openLightbox(i)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Gallery Grid — 2 or 4+ images (images-only, no video, only when no dedicated video) */}
          {!hasDedicatedVideo && mediaImages.length !== 3 && mediaImages.length > 1 && (
            <div
              className="block mt-3 rounded-2xl overflow-hidden border border-border cursor-pointer"
              style={{ maxHeight: '400px' }}
              onClick={handleClick}
            >
              <div
                className="grid gap-0.5"
                style={{
                  gridTemplateColumns: '1fr 1fr',
                  gridTemplateRows: mediaImages.length <= 2 ? '1fr' : '1fr 1fr',
                }}
              >
                {mediaImages.map((img, i) => (
                  <div
                    key={i}
                    className="overflow-hidden"
                    style={{ maxHeight: mediaImages.length >= 3 ? '200px' : '400px' }}
                  >
                    <img
                      alt=""
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      src={img}
                      style={{ maxHeight: mediaImages.length >= 3 ? '200px' : '400px' }}
                      onClick={openLightbox(i)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single Image — only when exactly 1 image, and no dedicated video */}
          {!hasDedicatedVideo && mediaImages.length === 1 && (
            <div
              className="block mt-3 rounded-2xl overflow-hidden border border-border cursor-pointer"
              style={{ maxHeight: '400px' }}
              onClick={handleClick}
            >
              <img
                alt=""
                className="w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                style={{ maxHeight: '400px' }}
                src={mediaImages[0]}
                onClick={openLightbox(0)}
              />
            </div>
          )}

          {/* Video — from post.video prop (not mediaUrls) — only when NO images */}
          {!hasImages && videoData && (
            <>
              {/* Processing / Pending state */}
              {videoData.status === 'pending' || videoData.status === 'processing' ? (
                <div
                  className="block mt-3 rounded-2xl overflow-hidden border border-border relative bg-neutral-900 group"
                  style={{ aspectRatio: '16/9', maxHeight: 'none' }}
                >
                  {videoData.thumbnailUrl ? (
                    <img
                      src={`${API_URL}/videos/${videoData.id}/thumb.jpg`}
                      alt="Video thumbnail"
                      className="w-full h-full object-cover opacity-60"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-5xl text-text-muted animate-pulse">videocam</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-4xl text-white animate-pulse">hourglass_empty</span>
                    <span className="text-text-muted text-sm">
                      {videoData.status === 'pending' ? 'กำลังเตรียมวิดีโอ...' : 'กำลังประมวลผล...'}
                    </span>
                  </div>
                  {/* Controls bar (disabled for pending/processing) */}
                  <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-1 px-3 pb-3 pt-16 bg-gradient-to-t from-black/80 to-transparent group-hover:opacity-100 opacity-60 transition-opacity">
                    <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
                      <div className="h-full bg-white/50 rounded-full" style={{ width: '0%' }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        data-no-nav
                        className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center cursor-not-allowed opacity-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="material-symbols-outlined text-white text-lg">play_arrow</span>
                      </button>
                      <span className="text-white text-xs tabular-nums">
                        0:00 / {formatDuration(videoData.duration || 0)}
                      </span>
                      <div className="flex-1" />
                      <button
                        data-no-nav
                        className="w-8 h-8 rounded-full flex items-center justify-center opacity-50 cursor-not-allowed"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="material-symbols-outlined text-white text-lg">volume_off</span>
                      </button>
                      <button
                        data-no-nav
                        className="w-8 h-8 rounded-full flex items-center justify-center opacity-50 cursor-not-allowed"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="material-symbols-outlined text-white text-lg">fullscreen</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : videoData.status === 'failed' ? (
                /* Failed state */
                <div
                  className="block mt-3 rounded-2xl overflow-hidden border border-border relative bg-neutral-900"
                  style={{ maxHeight: '200px', height: '150px' }}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-4xl text-red-400">error</span>
                    <span className="text-red-400 text-sm">อัปโหลดวิดีโอไม่สำเร็จ</span>
                    <span className="text-text-muted text-xs">{videoData.error}</span>
                  </div>
                </div>
              ) : videoData.status === 'ready' && videoData.videoUrl ? (
                /* Ready — thumbnail with play overlay, click to play inline */
                <div
                  data-no-nav
                  className="block mt-3 rounded-2xl overflow-hidden border border-border cursor-pointer relative group"
                  style={{ aspectRatio: '16/9', maxHeight: 'none' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setVideoData((prev) => prev ? { ...prev, _playing: true } : prev)
                  }}
                >
                  {!videoData._playing ? (
                    <>
                      {/* Hidden video to preload duration from API source */}
                      <video
                        ref={hiddenVideoRef}
                        className="hidden"
                        src={videoData.videoUrl ? `${API_URL}${videoData.videoUrl}` : `${API_URL}/videos/${videoData.id}/video_720.mp4`}
                        onLoadedMetadata={() => {
                          if (hiddenVideoRef.current && hiddenVideoRef.current.duration && videoData) {
                            setVideoData(prev => prev ? { ...prev, duration: hiddenVideoRef.current!.duration } : prev)
                          }
                        }}
                      />
                      <img
                        src={`${API_URL}/videos/${videoData.id}/thumb.jpg`}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                      />
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/70 transition-colors">
                          <span className="material-symbols-outlined text-white text-4xl" style={{ marginLeft: '3px' }}>play_arrow</span>
                        </div>
                      </div>
                      {/* Duration badge — bottom right */}
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono tabular-nums">
                        {formatDuration(videoData.duration || 0)}
                      </div>
                      
                    </>
                  ) : (
                    <div className="relative bg-black">
                      <video
                        ref={videoRef}
                        key={videoData.id}
                        src={videoData.videoUrl ? `${API_URL}${videoData.videoUrl}` : `${API_URL}/videos/${videoData.id}/video_720.mp4`}
                        poster={`${API_URL}/videos/${videoData.id}/thumb.jpg`}
                        preload="auto"
                        muted={isMuted}
                        className="w-full h-full object-cover"
                        onTimeUpdate={() => setVideoCurrentTime(videoRef.current?.currentTime || 0)}
                        onLoadedMetadata={() => {
                          if (videoRef.current && videoRef.current.duration && videoData) {
                            setVideoData(prev => prev ? { ...prev, duration: videoRef.current!.duration } : prev)
                          }
                        }}
                        onPlay={() => setVideoPaused(false)}
                        onPause={() => setVideoPaused(true)}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (videoRef.current) {
                            if (videoRef.current.paused) {
                              videoRef.current.play()
                            } else {
                              videoRef.current.pause()
                            }
                          }
                        }}
                      />
                      {/* Controls bar — playing: always visible */}
                      <div data-video-controls className="absolute bottom-0 left-0 right-0 flex flex-col gap-1 px-3 pb-3 pt-16 bg-gradient-to-t from-black/80 to-transparent opacity-100 pointer-events-auto">
                        {/* Progress bar */}
                        <div
                          className="w-full h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer pointer-events-auto"
                          onClick={(e) => { e.stopPropagation(); if (videoRef.current && videoData.duration) videoRef.current.currentTime = ((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.getBoundingClientRect().width) * videoData.duration }}
                        >
                          <div className="h-full bg-white rounded-full" style={{ width: videoData.duration ? `${(videoCurrentTime / videoData.duration) * 100}%` : '0%' }} />
                        </div>
                        {/* Buttons */}
                        <div className="flex items-center gap-2 pointer-events-auto">
                          <button data-no-nav className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors" onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause() }}>
                            <span className="material-symbols-outlined text-white text-lg">{!videoPaused ? 'pause' : 'play_arrow'}</span>
                          </button>
                          <span className="text-white text-xs tabular-nums">{formatDuration(Math.floor(videoCurrentTime))} / {formatDuration(videoData.duration || 0)}</span>
                          <div className="flex-1" />
                          {/* Settings */}
                          <div className="relative">
                            <button data-no-nav className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors" onClick={(e) => { e.stopPropagation(); setSettingsOpen(!settingsOpen); if (!settingsOpen) setSettingsExpandedSection(null) }}>
                              <span className="material-symbols-outlined text-white text-lg">settings</span>
                            </button>
                            {settingsOpen && (
                              <div className="absolute bottom-full right-0 mb-2 bg-[#2f3336] border border-[#38444d] rounded-xl shadow-xl overflow-hidden min-w-[160px] z-50" onClick={(e) => e.stopPropagation()}>
                                {/* Playback Speed */}
                                <div
                                  className="px-3 py-2 cursor-pointer hover:bg-white/5"
                                  onClick={() => setSettingsExpandedSection(settingsExpandedSection === 'speed' ? null : 'speed')}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#8b98a5] text-xs font-semibold">ความเร็วในการเล่น</span>
                                    <span className="text-white text-xs">{settingsExpandedSection === 'speed' ? '▲' : '▼'}</span>
                                  </div>
                                  {settingsExpandedSection === 'speed' && (
                                    <div className="mt-1 space-y-0.5">
                                      {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                                        <div key={r} className={`text-sm px-2 py-1 rounded cursor-pointer ${playbackRate === r ? 'text-[#1d9bf0] font-bold' : 'text-white hover:bg-white/10'}`} onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.playbackRate = r; setPlaybackRate(r); setSettingsOpen(false) }}>{r}x</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <button data-no-nav className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors" onClick={(e) => { e.stopPropagation(); if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setIsMuted(!isMuted) } }}>
                            <span className="material-symbols-outlined text-white text-lg">{isMuted ? 'volume_off' : 'volume_up'}</span>
                          </button>
                          <button data-no-nav className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors" onClick={(e) => { e.stopPropagation(); const c = videoRef.current?.parentElement; if (c) document.fullscreenElement ? document.exitFullscreen() : c.requestFullscreen() }}>
                            <span className="material-symbols-outlined text-white text-lg">fullscreen</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}

          {/* Legacy inline video from mediaUrls (fallback for old posts) */}
          {mediaVideos.length > 0 && !videoData && (
            <div
              className="block mt-3 rounded-2xl overflow-hidden border border-border cursor-pointer relative group"
              style={{ maxHeight: '400px' }}
              onClick={handleClick}
            >
              <video
                src={mediaVideos[0]}
                className="w-full object-cover cursor-pointer"
                style={{ maxHeight: '400px' }}
                onClick={(e) => {
                  e.stopPropagation()
                  // Navigate to thread to play video
                  router.push(`/posts/${post.id}`)
                }}
                controls
              />
            </div>
          )}

          {/* Actions */}
          <PostActions
            postId={post.id}
            liked={liked}
            reposted={reposted}
            likeCount={likeCount}
            repostCount={typeof post.stats.reposts === 'number' ? post.stats.reposts : 0}
            commentCount={typeof post.stats.comments === 'number' ? post.stats.comments : 0}
            viewCount={post.stats.views}
            onLike={handleLike}
            onRepost={() => onRepost?.(post.id)}
            onQuote={() => onQuote?.(post.id)}
            onComment={() => onComment?.(rawPost ?? post)}
            post={rawPost ?? post}
            isReposted={reposted}
          />
        </div>
      </div>
      </article>

    {/* Lightbox for images (video is played inline, not in lightbox) */}
    {lightboxIndex !== null && mediaImages.length > 0 ? (
      <Lightbox
        open
        close={closeLightbox}
        slides={mediaImages.map((src) => ({ src }))}
        index={lightboxIndex}
        render={{
          buttonPrev: mediaImages.length > 1 ? undefined : () => null,
          buttonNext: mediaImages.length > 1 ? undefined : () => null,
        }}
      />
    ) : null}
    </>
  )
}
