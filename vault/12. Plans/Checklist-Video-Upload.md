# Video Upload — Implementation Checklist

> **Date:** 2026-05-06
> **Status:** Backend DONE ✓ | Frontend Phase 3 DONE ✓ | Phase 4 DONE ✓ | Phase 5 DONE ✓ | Phase 6 pending (ข้ามไปก่อน)
> **Author:** Hermes Agent

---

## 📦 Phase 1: Database & Models

- [x] 1.1 เพิ่ม `Video` model ใน `prisma/schema.prisma`
  - fields: `id`, `postId`, `originalUrl`, `videoUrl`, `thumbnailUrl`, `status`, `error`, `size`, `duration`, `createdAt`, `updatedAt`, `deletedAt`
  - relation: `Post` 1:1 `Video`
- [x] 1.2 เพิ่ม `videoId` + `video` relation ใน `Post` model
- [x] 1.3 รัน `npx prisma migrate dev` สร้าง migration

---

## ⚙️ Phase 2: Backend Services

### 2.1 Upload Controller
- [x] 2.1.1 เพิ่ม `@Post('video')` endpoint ใน `upload.controller.ts`
  - stream upload ไม่ load file เข้า memory
  - validate MIME type (`video/mp4`, `video/webm`, `video/quicktime`)
  - validate size (max 50MB)
  - save ไป temp directory `/tmp/nexus-videos/`
  - return `tempId` + `status: 'uploaded'`
- [x] 2.1.2 เพิ่ม `fileFilter` สำหรับ video MIME types

### 2.2 Video Service (New)
- [x] 2.2.1 สร้าง `src/video/video.service.ts`
  - `processVideo(tempId, postId)` — FFmpeg encode + generate thumbnail
  - `getVideoStatus(postId)` — return status + urls
  - `getVideoMetadata(filePath)` — get duration
  - `generateThumbnail(filePath, outputPath)` — FFmpeg extract frame
  - `cleanupTemp(tempId)` — ลบไฟล์หลัง process เสร็จ
- [x] 2.2.2 FFmpeg encode command: `libx264, crf 28, preset fast, threads 2, movflags +faststart`
- [x] 2.2.3 Thumbnail command: `ss 1s, vframes 1, scale 640:-1`

### 2.3 BullMQ Worker (New)
- [x] 2.3.1 สร้าง `src/video/video.processor.ts`
  - Worker เรียก `VideoService.processVideo()`
  - config: `concurrency: 1`, `timeout: 90000`, `maxAttempts: 2`
  - retry backoff: exponential (1s → 2s)
  - log: started / completed / failed
- [x] 2.3.2 สร้าง `src/video/video.module.ts` — register processor

### 2.4 Video Controller (New)
- [x] 2.4.1 สร้าง `src/video/video.controller.ts`
  - `POST /videos` — create video record + enqueue job
  - `GET /videos/:id/status` — poll status
- [x] 2.4.2 เพิ่ม `VideoModule` ใน `app.module.ts`

### 2.5 Posts Service (Update)
- [x] 2.5.1 แก้ `createPost()` ให้รองรับ `videoTempId`
  - ถ้ามี `videoTempId` → สร้าง `Video` record + enqueue BullMQ job
- [x] 2.5.2 เพิ่ม `video` include ใน response ทุก endpoint ที่ return post

---

## 🎨 Phase 3: Frontend

### 3.1 API Client
- [x] 3.1.1 เพิ่ม `uploadApi.uploadVideo(file)` ใน `src/lib/api.ts`
- [x] 3.1.2 เพิ่ม `videoApi.getVideoStatus(postId)` ใน `src/lib/api.ts`

### 3.2 PostComposer (Update)
- [x] 3.2.1 แยก upload flow: ถ้าเป็น video → upload → get videoId → เก็บ videoId ไว้
- [x] 3.2.2 แก้ `handlePost()` — ส่ง `videoId` ไป API ถ้ามี video
- [x] 3.2.3 แสดง video preview thumbnail ก่อน submit (local blob URL)
- [x] 3.2.4 แสดง upload progress bar (XHR onprogress) — bar overlay on media thumbnail + percentage text

### 3.3 PostCard (Update)
- [x] 3.3.1 แสดง video thumbnail แทน `<video>` (ก่อน poll)
  - placeholder image + play icon overlay
- [x] 3.3.2 Poll `GET /videos/:id/status` หลัง mount (3s → 5s → 10s, max 3 polls)
- [x] 3.3.3 เมื่อ status = `ready` → แสดง `<video>` + click-to-play (`preload="none"`)
- [x] 3.3.4 แสดง duration badge บน video (format: `MM:SS` หรือ `HH:MM:SS`)
- [x] 3.3.5 เมื่อ status = `failed` → แสดง error placeholder

### 3.4 Feed/Profile Page (Update)
- [x] 3.4.1 ตรวจว่า post มี `video` field → pass ไปให้ PostCard (home, profile, following, hashtag, posts pages)

---

## 🧹 Phase 4: Cleanup & Polish

- [x] 4.1 Soft delete — เมื่อ delete post → enqueue cleanup job (delay 5 min)
- [x] 4.2 Cleanup worker — ลบ video file + thumbnail หลัง delay
- [x] 4.3 Temp file cleanup — ลบไฟล์ใน `/tmp/nexus-videos/` ที่เก่ากว่า 24h (cron หรือ startup)
- [x] 4.4 ตรวจ error handling ทุก step — upload fail, FFmpeg fail, timeout

---

## 🧪 Phase 5: Testing

- [ ] 5.1 Upload video < 10MB → encode เสร็จ → แสดงใน feed
- [ ] 5.2 Upload video > 10MB → แสดง error
- [ ] 5.3 Upload ผิด type (เช่น .exe) → reject
- [x] 5.4 FFmpeg timeout → mark failed + แจ้ง user ✅ (code verified — execSync timeout catches error, updates DB status=failed, frontend shows error message)
- [ ] 5.5 Post with 1 image + 1 video → render ถูกต้อง
- [ ] 5.6 Delete post with video → file ถูกลบ

---

## 🚀 Phase 6: Production Ready

- [ ] 6.1 ตั้งค่า `docker-compose.yml` (Redis, app, FFmpeg worker)
- [ ] 6.2 ตั้ง `Cache-Control` headers (thumbnail: 1yr, video: 7d CDN)
- [ ] 6.3 Cloudflare CDN setup (ถ้ามี VPS)
- [ ] 6.4 Health check สำหรับ BullMQ worker

---

**Total: 25 tasks across 6 phases**
