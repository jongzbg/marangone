'use client'

import { useState, useRef, useEffect } from 'react'
import { postApi, uploadApi } from '@/lib/api'
import data from '@emoji-mart/data'
import EmojiPicker from '@emoji-mart/react'

interface PostComposerProps {
  onPostCreated?: () => void
  avatarUrl?: string | null
  username?: string
}

interface MediaFile {
  url: string
  preview: string
  isVideo?: boolean
  videoId?: string   // populated after video upload
}

type ProcessingState = {
  type: 'idle' | 'compressing' | 'uploading'
  pct: number
  label: string
}

/** Upload progress: 0-90% from XHR, server confirms at 100% */

// Upload with XHR progress tracking
function uploadWithProgress(file: Blob, fileName: string, onProgress: (pct: number) => void): Promise<{ videoId: string; url: string; originalUrl?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file, fileName)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 90)) // cap at 90% until server confirms
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve(JSON.parse(xhr.responseText))
      } else {
        let errData = {}
        try { errData = JSON.parse(xhr.responseText || '{}') } catch {}
        reject({ status: xhr.status, data: errData })
      }
    })

    xhr.addEventListener('error', () => reject({ status: 0 }))
    xhr.open('POST', 'http://localhost:3001/upload/video')
    const token = localStorage.getItem('token')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(formData)
  })
}

export default function PostComposer({ onPostCreated, avatarUrl, username }: PostComposerProps) {
  const [content, setContent] = useState('')
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  /**
   * Per-file processing state.
   * - type 'compressing': shows compression progress
   * - type 'uploading': shows upload progress (0-90%, then server confirms to 100%)
   * - type 'idle': done
   */
  const [processingState, setProcessingState] = useState<Record<number, ProcessingState>>({})
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  const avatar =
    avatarUrl || (username ? `https://api.dicebear.com/7.x/identicon/svg?seed=${username}` : '')

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiOpen(false)
      }
    }
    if (emojiOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [emojiOpen])

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current
    if (!ta) {
      setContent((prev) => prev + emoji)
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = content.slice(0, start) + emoji + content.slice(end)
    setContent(next)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }

  const handleEmojiSelect = (emoji: { native: string }) => {
    insertEmoji(emoji.native)
    setEmojiOpen(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const MAX_MEDIA = 4
    if (mediaFiles.length + files.length > MAX_MEDIA) {
      setUploadError(`โปรดเลือกรูปภาพ วิดีโอ สูงสุด ${MAX_MEDIA} รายการ`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    const uploaded: MediaFile[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const preview = URL.createObjectURL(file)
        const isVideo = file.type.startsWith('video/')

        if (isVideo) {
          // ── Validate max duration (1 minute) before upload ──────────────
          const videoEl = document.createElement('video')
          videoEl.src = preview
          const duration = await new Promise<number>((resolve) => {
            videoEl.addEventListener('loadedmetadata', () => resolve(videoEl.duration), { once: true })
            videoEl.addEventListener('error', () => resolve(999), { once: true })
          })
          if (duration > 60) {
            URL.revokeObjectURL(preview)
            setUploadError('วิดีโอต้องมีความยาวไม่เกิน 1 นาที')
            if (fileInputRef.current) fileInputRef.current.value = ''
            setUploading(false)
            return
          }

          // ── Validate max file size (10MB) before upload ──────────────────
          const MAX_VIDEO_SIZE = 10 * 1024 * 1024 // 10MB
          if (file.size > MAX_VIDEO_SIZE) {
            URL.revokeObjectURL(preview)
            setUploadError(`ไฟล์มีขนาด ${(file.size / 1024 / 1024).toFixed(1)}MB เกินขนาดสูงสุด 10MB กรุณาเลือกไฟล์ที่เล็กกว่า`)
            if (fileInputRef.current) fileInputRef.current.value = ''
            setUploading(false)
            return
          }

          // Upload directly — server-side FFmpeg handles encoding
          setProcessingState((prev) => ({ ...prev, [uploaded.length]: { type: 'uploading', pct: 0, label: 'กำลังอัปโหลด...' } }))
          const res = await uploadWithProgress(file, file.name, (pct) => {
            setProcessingState((prev) => ({
              ...prev,
              [uploaded.length]: { type: 'uploading', pct, label: `อัปโหลด ${pct}%` },
            }))
          })
          setProcessingState((prev) => ({ ...prev, [uploaded.length]: { type: 'idle', pct: 100, label: '' } }))
          uploaded.push({
            url: res.originalUrl || res.url,
            preview,
            isVideo: true,
            videoId: res.videoId,
          })
        } else {
          // Image — upload directly (images are usually small enough)
          const res = await uploadApi.uploadImage(file)
          uploaded.push({ url: res.data.url, preview, isVideo: false })
        }
      }
      setMediaFiles((prev) => [...prev, ...uploaded].slice(0, 4))
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status
      if (status === 413) {
        setUploadError('ไฟล์มีขนาดใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่เล็กกว่า')
      } else if (status === 400) {
        setUploadError('รองรับเฉพาะไฟล์วิดีโอ mp4, webm, mov')
      } else if (status === 401) {
        setUploadError('กรุณา login ก่อนอัปโหลด')
      } else {
        const msg = err?.data?.message || err?.response?.data?.message
        // 413 = Multer hard limit exceeded (image=10MB, video=50MB)
        const sizeMsg = status === 413 ? 'ไฟล์มีขนาดใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่เล็กกว่า' : null
        setUploadError(sizeMsg || msg || 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่')
      }
      console.error('Failed to upload media:', err)
    } finally {
      setUploading(false)
      setProcessingState({})
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].preview)
      next.splice(index, 1)
      return next
    })
  }

  const handlePost = async () => {
    if (!content.trim() && mediaFiles.length === 0) return

    setLoading(true)
    try {
      const mediaUrls = mediaFiles.map((m) => m.url)
      const videoId = mediaFiles.find((m) => m.isVideo)?.videoId
      await postApi.createPost(content.trim(), mediaUrls, videoId)
      setContent('')
      mediaFiles.forEach((m) => URL.revokeObjectURL(m.preview))
      setMediaFiles([])
      onPostCreated?.()
      window.dispatchEvent(new CustomEvent('nexus:post-created'))
    } catch (err) {
      console.error('Failed to create post:', err)
    } finally {
      setLoading(false)
    }
  }

  // Render progress bar for a media index
  const renderProgress = (i: number) => {
    const state = processingState[i]
    if (!state || state.type === 'idle') return null
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-end bg-black/40">
        <span className="text-white text-xs font-medium mb-1">{state.label}</span>
        <div className="w-full h-1.5 bg-white/30 rounded-full mx-2 mb-3 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${state.pct}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 border-b border-border flex gap-4">
      <img
        alt="Me"
        className="w-10 h-10 rounded-full shrink-0"
        src={avatar}
      />
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full bg-transparent border-none focus:ring-0 text-xl text-text-primary placeholder-text-muted resize-none h-24"
          placeholder="What is happening?!"
        />

        {/* Media preview */}
        {mediaFiles.length > 0 && (
          <>
            {mediaFiles.length === 3 ? (
              <div className="flex gap-2 mt-2 h-64">
                <div className="relative flex-1 rounded-xl overflow-hidden bg-surface-base border border-border min-w-0">
                  {mediaFiles[0].url.match(/\.(mp4|webm|mov)$/i) ? (
                    <video src={mediaFiles[0].preview} controls className="w-full h-full object-cover" />
                  ) : (
                    <img src={mediaFiles[0].preview} alt="" className="w-full h-full object-cover" />
                  )}
                  {renderProgress(0)}
                  <button
                    type="button"
                    onClick={() => removeMedia(0)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white text-xs font-bold transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  {[1, 2].map((i) => (
                    <div key={i} className="relative flex-1 rounded-xl overflow-hidden bg-surface-base border border-border min-h-0">
                      {mediaFiles[i].url.match(/\.(mp4|webm|mov)$/i) ? (
                        <video src={mediaFiles[i].preview} controls className="w-full h-full object-cover" />
                      ) : (
                        <img src={mediaFiles[i].preview} alt="" className="w-full h-full object-cover" />
                      )}
                      {renderProgress(i)}
                      <button
                        type="button"
                        onClick={() => removeMedia(i)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white text-xs font-bold transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`grid gap-2 mt-2 ${mediaFiles.length === 2 ? 'grid-cols-2 h-64' : mediaFiles.length >= 3 ? 'grid-cols-2' : 'grid-cols-1 h-64'}`}>
                {mediaFiles.map((media, i) => (
                  <div key={i} className={`relative rounded-xl overflow-hidden bg-surface-base border border-border ${mediaFiles.length === 2 ? 'h-64' : ''}`}>
                    {media.url.match(/\.(mp4|webm|mov)$/i) ? (
                      <video src={media.preview} controls className="w-full h-full object-cover" />
                    ) : (
                      <img src={media.preview} alt="" className="w-full h-full object-cover" />
                    )}
                    {renderProgress(i)}
                    <button
                      type="button"
                      onClick={() => removeMedia(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white text-xs font-bold transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {uploadError}
          </div>
        )}

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1 text-primary">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2 hover:bg-primary/10 rounded-full transition-colors disabled:opacity-50"
              title="Add image or video"
            >
              {uploading ? (
                <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-xl">image</span>
              )}
            </button>

            {/* Emoji picker */}
            <div className="relative" ref={emojiRef}>
              <button
                type="button"
                onClick={() => setEmojiOpen((prev) => !prev)}
                className="p-2 hover:bg-primary/10 rounded-full transition-colors"
                title="Add Emoji"
              >
                <span className="material-symbols-outlined text-xl">sentiment_satisfied</span>
              </button>

              {emojiOpen && (
                <div className="absolute top-full left-0 mt-2 z-50">
                  <EmojiPicker
                    data={data}
                    onEmojiSelect={handleEmojiSelect}
                    theme="dark"
                    previewPosition="none"
                    skinTonePosition="preview"
                    searchPosition="sticky"
                    maxFrequentRows={2}
                  />
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handlePost}
            disabled={(!content.trim() && mediaFiles.length === 0) || loading}
            className="bg-primary text-white font-bold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'กำลังโพสต์...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}