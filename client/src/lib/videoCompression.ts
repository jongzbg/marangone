'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

export type VideoQuality = '240p' | '360p' | '480p'

const QUALITY_SETTINGS: Record<VideoQuality, { height: number; crf: number; audioBitrate: string; label: string }> = {
  '240p': { height: 240, crf: 30, audioBitrate: '32k', label: '240p — เร็วสุด, ความละเอียดต่ำ' },
  '360p': { height: 360, crf: 28, audioBitrate: '48k', label: '360p — สมดุล' },
  '480p': { height: 480, crf: 26, audioBitrate: '96k', label: '480p — คุณภาพดีที่สุด' },
}

export const ALL_QUALITIES: VideoQuality[] = ['480p', '360p', '240p']

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoading: Promise<FFmpeg> | null = null

/**
 * Singleton FFmpeg instance — loaded once per page session.
 * Uses toBlobURL to load core + wasm as blob URLs (avoids SSR module resolution issues).
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance
  if (ffmpegLoading) return ffmpegLoading

  const ffmpeg = new FFmpeg()
  ffmpegLoading = (async () => {
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    ])
    await ffmpeg.load({ coreURL, wasmURL })
    ffmpegInstance = ffmpeg
    return ffmpeg
  })()

  return ffmpegLoading
}

export interface CompressionResult {
  blob: Blob
  originalSize: number
  compressedSize: number
  duration: number
}

export async function compressVideo(
  file: File,
  quality: VideoQuality = '480p',
  onProgress?: (pct: number) => void
): Promise<CompressionResult> {
  const start = performance.now()
  const ffmpeg = await getFFmpeg()

  const { height, crf, audioBitrate } = QUALITY_SETTINGS[quality]

  const arrayBuffer = await file.arrayBuffer()
  await ffmpeg.writeFile('input.mp4', new Uint8Array(arrayBuffer))

  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vf', `scale=-2:${height}`,
    '-crf', String(crf),
    '-preset', 'veryfast',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-b:a', audioBitrate,
    '-movflags', '+faststart',
    'output.mp4',
  ])

  onProgress?.(100)

  await ffmpeg.deleteFile('input.mp4')
  const data = await ffmpeg.readFile('output.mp4') as Uint8Array
  await ffmpeg.deleteFile('output.mp4')

  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' })
  const duration = (performance.now() - start) / 1000

  return {
    blob,
    originalSize: file.size,
    compressedSize: blob.size,
    duration,
  }
}

export function preloadFFmpeg(): void {
  getFFmpeg().catch(console.error)
}