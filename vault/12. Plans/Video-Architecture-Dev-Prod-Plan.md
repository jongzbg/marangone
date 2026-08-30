# Video Upload Architecture — Dev & Prod Plan

> **Date:** 2026-05-06
> **Status:** Ready for Implementation
> **Author:** Hermes Agent + GPT Review

---

## 🎯 Executive Summary

Nexus Social จะเพิ่มระบบ **Video Upload** ที่รองรับ 20-50 videos/day สำหรับ MVP

**หลักคิด:**
- MVP ใช้ local storage → deploy VPS → อัพเกรด R2 ตอนมี traffic จริง
- Cost target: **$0 ตอน dev, ~$10-13/เดือน ตอน prod**

---

## 🔥 Key Decisions (Final)

| Decision | Value | Rationale |
|----------|-------|-----------|
| Upload method | Stream upload (ไม่ load ทั้ง file) | ป้องกัน memory spike |
| Encoding | FFmpeg (local) | Open source, CPU-bound |
| Queue | BullMQ + Redis | Production-ready, reliable |
| Playback | Click-to-play (ไม่ autoplay) | ลด bandwidth + cost |
| Storage (Dev) | Local disk (`/uploads`) | ฟรี, ไม่เสียเงิน |
| Storage (Prod) | Local disk + Cloudflare CDN | ถูก + effective |
| R2 | รอไปก่อน | อัพเกรดได้เสมอเมื่อมี traffic |
| Concurrency | **1 job at a time** | FFmpeg = CPU 100%, อย่า optimize เร็ว |

---

## 1. Dev Plan (Local — $0)

### 1.1 Infrastructure

| Component | Tool | Spec | Cost |
|-----------|------|------|------|
| Server | เครื่อง dev หรือ local Docker | 1 vCPU / 2GB | $0 |
| Database | SQLite หรือ PostgreSQL (Docker) | Local | $0 |
| Queue | BullMQ + Redis (Docker) | In-memory | $0 |
| Storage | Local disk (`/uploads`) | 10-20GB | $0 |
| FFmpeg | ติดตั้งใน Docker หรือ host | Latest | $0 |

### 1.2 Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL VIDEO FLOW (DEV)                       │
│                                                                  │
│  User upload → Next.js API Route (stream upload)                │
│                         │                                        │
│              ┌─────────▼──────────┐                             │
│              │  1. Validate       │                             │
│              │     • File type    │                             │
│              │     • File size    │                             │
│              │     • Max 50MB     │                             │
│              └─────────┬──────────┘                             │
│                        │                                        │
│              ┌─────────▼──────────┐                             │
│              │  2. Save temp     │                             │
│              │     → /tmp/       │                             │
│              │     → Return      │                             │
│              │       temp ID     │                             │
│              └─────────┬──────────┘                             │
│                        │                                        │
│              ┌─────────▼──────────┐                             │
│              │  3. Enqueue       │                             │
│              │     BullMQ job     │                             │
│              │     { tempId,     │                             │
│              │       postId }    │                             │
│              └─────────┬──────────┘                             │
│                        │                                        │
│              ┌─────────▼──────────┐                             │
│              │  4. BullMQ Worker │                             │
│              │     • FFmpeg      │                             │
│              │     • timeout 90s │                             │
│              │     • threads 2   │                             │
│              │     • concurrency │                             │
│              │       = 1         │                             │
│              └─────────┬──────────┘                             │
│                        │                                        │
│              ┌─────────▼──────────┐                             │
│              │  5. Save output   │                             │
│              │     → /uploads/   │                             │
│              │     → Return URL  │                             │
│              └─────────┬──────────┘                             │
│                        │                                        │
│              ┌─────────▼──────────┐                             │
│              │  6. Update DB      │                             │
│              │     status: ready  │                             │
│              │     videoUrl: ...  │                             │
│              └─────────────────────┘                             │
│                                                                  │
│  Frontend Polling:                                               │
│  • 3s → 5s → 10s → stop (max 3 polls)                         │
│  • Stop immediately when status = ready/failed                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Frontend UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   UPLOAD UX FLOW                              │
│                                                              │
│  1. User กด upload video                                      │
│         ↓                                                    │
│  2. แสดง progress bar (upload %)                            │
│         ↓                                                    │
│  3. Upload เสร็จ → แสดง thumbnail placeholder              │
│         ↓                                                    │
│  4. User กด submit post                                      │
│         ↓                                                    │
│  5. Frontend poll status (3s → 5s → 10s)                    │
│         ↓                                                    │
│  6. status = ready → แสดง video player (click-to-play)      │
│                                                              │
│  Video Tag:                                                   │
│  • <video preload="none" controls>                          │
│  • ไม่ autoplay — user ต้องกดเล่นเอง                        │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Key Config — Dev

```yaml
# docker-compose.yml (สำหรับ dev)
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: .
    environment:
      - REDIS_HOST=redis
      - VIDEO_MAX_SIZE=52428800  # 50MB
      - VIDEO_TIMEOUT=90000      # 90s
      - VIDEO_CONCURRENCY=1
      - VIDEO_THREADS=2
    volumes:
      - ./uploads:/app/uploads
```

```typescript
// FFmpeg worker config
const workerConfig = {
  concurrency: 1,           // 1 job at a time
  timeout: 90000,           // 90s timeout
  maxAttempts: 2,           // retry max 2 ครั้ง
  backoff: {
    type: 'exponential',
    delay: 1000,            // 1s → 2s → 4s
  },
}
```

```typescript
// Frontend polling config
const POLLING_INTERVALS = [3000, 5000, 10000] // 3s → 5s → 10s
const MAX_POLL_ATTEMPTS = 3

// หยุดทันทีเมื่อ ready
if (status === 'ready' || status === 'failed') return
```

---

## 2. Prod Plan (VPS — ~$10-13/เดือน)

### 2.1 Infrastructure

#### แผน A: ไม่ใช้ R2 (แนะนำตอนนี้)

| Component | Tool | Spec | ค่าใช้จ่าย/เดือน |
|-----------|------|------|-------------------|
| VPS | DigitalOcean / Hetzner / Contabo | 2 vCPU / 2GB RAM | $10-12 |
| Database | PostgreSQL (Docker ใน VPS) | 10GB storage | $0 (รวมใน VPS) |
| Queue | BullMQ + Redis | Self-host ใน VPS | $0 |
| Storage | Local disk (`/uploads`) | 20GB | $0 (รวมใน VPS) |
| CDN | Cloudflare (free tier) | Cache origin | $0 |
| Domain + SSL | Cloudflare proxy | — | $0 |
| **รวม** | | | **$10-12 (~350-420 บาท)** |

#### แผน B: อัพเกรดไป R2 (ตอนมี traffic จริง)

| Component | Tool | Spec | ค่าใช้จ่าย/เดือน |
|-----------|------|------|-------------------|
| VPS | เหมือนแผน A | 2 vCPU / 2GB | $10-12 |
| Storage | Cloudflare R2 | 1-2GB + ~10k requests | $0.5-1 |
| CDN | Cloudflare (รวม) | Cache R2 directly | $0 |
| Workers | Cloudflare Workers (optional) | Resize proxy | $0-5 |
| **รวม** | | | **$10.5-18 (~370-630 บาท)** |

### 2.2 Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION VIDEO FLOW                         │
│                                                                  │
│  User ──upload──► Next.js API Route (stream)                    │
│                            │                                     │
│                   ┌─────────▼──────────┐                        │
│                   │  Save temp file     │                        │
│                   │  Validate size/type │                        │
│                   └─────────┬──────────┘                        │
│                             │                                    │
│                   ┌─────────▼──────────┐                        │
│                   │  Enqueue BullMQ     │                        │
│                   │  Job: encode_video  │                        │
│                   └─────────┬──────────┘                        │
│                             │                                    │
│                   ┌─────────▼──────────┐                        │
│                   │  Redis Queue       │                        │
│                   │  (Concurrency = 1) │                        │
│                   └─────────┬──────────┘                        │
│                             │                                    │
│                   ┌─────────▼──────────┐                        │
│                   │  FFmpeg Worker     │                        │
│                   │  timeout = 90s     │                        │
│                   │  threads = 2       │                        │
│                   └─────────┬──────────┘                        │
│                             │                                    │
│                   ┌─────────▼──────────┐                        │
│                   │  Save → /uploads   │                        │
│                   │  (or R2 bucket)    │                        │
│                   └─────────┬──────────┘                        │
│                             │                                    │
│                   ┌─────────▼──────────┐                        │
│                   │  Cloudflare CDN    │                        │
│                   │  (cache headers)   │                        │
│                   └─────────┬──────────┘                        │
│                             │                                    │
│                   ┌─────────▼──────────┐                        │
│                   │  User watch video  │                        │
│                   │  (click-to-play)   │                        │
│                   └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 CDN Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                     CDN CACHING FLOW                             │
│                                                                  │
│  User request ──► Cloudflare CDN                               │
│                          │                                       │
│                 ┌────────▼────────┐                             │
│                 │   Cache hit?     │                             │
│                 └────────┬────────┘                             │
│                    YES  /   \  NO                                │
│                   /          \                                   │
│      (serve from CDN)    (fetch from VPS origin)               │
│                              │                                   │
│                        Cache at edge                             │
│                                                                  │
│  Cache-Control Headers:                                         │
│  ┌──────────────────┬────────────────────────────────────────┐  │
│  │ Thumbnail        │ public, max-age=31536000, immutable   │  │
│  │ (1 year)         │ → เปลี่ยนทีต้องเปลี่ยน URL hash        │  │
│  ├──────────────────┼────────────────────────────────────────┤  │
│  │ Video            │ public, max-age=86400,                 │  │
│  │                  │ s-maxage=604800                        │  │
│  │                  │ (1d browser / 7d CDN)                  │  │
│  ├──────────────────┼────────────────────────────────────────┤  │
│  │ API Response     │ private, no-cache                       │  │
│  └──────────────────┴────────────────────────────────────────┘  │
│                                                                  │
│  R2 Object Key Strategy (ถ้าใช้ R2):                           │
│  /videos/{videoId}/video-v1.mp4   ✓ immutable, cache friendly │
│  /videos/{videoId}/thumb-v1.jpg   ✓ immutable, cache friendly │
│                                                                  │
│  ห้ามใช้:                                                       │
│  /videos/latest.mp4               ✗ cache แตกทันที            │
│  /videos/user123/video.mp4        ✗ cache แตกทันที            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Polling Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                      POLLING STRATEGY                            │
│                                                                  │
│  Frontend                       Backend                          │
│     │                             │                              │
│     │── GET /videos/:id/status ──►│ (3s interval)              │
│     │◄─ { status: "processing" } │                              │
│     │                             │                              │
│     │── GET ... ──────────────────►│ (5s interval)              │
│     │◄─ { status: "processing" } │                              │
│     │                             │                              │
│     │── GET ... ──────────────────►│ (10s interval)             │
│     │◄─ { status: "ready",         │ ← STOP! ไม่ poll ต่อ       │
│     │    videoUrl: "..." }         │                              │
│     │                             │                              │
│  Max polls: 3 ครั้ง (3s → 5s → 10s)                            │
│                                                                  │
│  Edge Cases:                                                   │
│  • status = "failed" → แสดง error และ stop polling            │
│  • Timeout (> 90s) → mark failed และ stop polling             │
│  • Network error → retry ครั้งเดียว แล้ว stop                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.5 Soft Delete + Cleanup Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  SOFT DELETE + CLEANUP FLOW                     │
│                                                                  │
│  User clicks delete:                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. mark deletedAt = NOW()          ← DB source of truth   │ │
│  │ 2. enqueue BullMQ cleanup job      ← delay 5 min         │ │
│  │ 3. return success to user                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            ↓                                     │
│  Cleanup Worker (BullMQ):                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. Wait 5 min (delay)                                        │ │
│  │ 2. Check: still deletedAt? (user อาจ restore?)             │ │
│  │ 3. Delete files from disk/R2                                 │ │
│  │ 4. Log cleanup result                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            ↓                                     │
│  Cron Job (runs daily at 3 AM):                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Delete orphaned media (DB record gone but file exists)   │ │
│  │ • Delete temp files > 24h                                   │ │
│  │ • Clean up failed/expired uploads                           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.6 VPS Setup Checklist

```bash
# 1. Server setup
apt update && apt upgrade -y
apt install -y docker.io docker-compose

# 2. Firewall
ufw allow 22    # SSH
ufw allow 80   # HTTP
ufw allow 443  # HTTPS
ufw enable

# 3. Docker compose for services
# - PostgreSQL
# - Redis
# - Next.js app
# - FFmpeg worker

# 4. Cloudflare setup
# - Proxy DNS to VPS
# - Enable CDN
# - SSL certificate (Auto)
```

---

## 3. Cost Breakdown

### 3.1 Dev Cost

| วิธี | ค่าใช้จ่าย/เดือน |
|------|-------------------|
| Local (เครื่อง dev) | $0 |
| VPS dev (ถ้าใช้) | ~$5-6 |
| **รวม** | **$0-6 (~0-220 บาท)** |

### 3.2 Prod Cost — แผน A (ไม่ R2)

| Component | Cost/เดือน | Notes |
|-----------|-------------|-------|
| VPS 2vCPU/2GB | $10-12 | DigitalOcean / Hetzner |
| Storage | $0 | Local disk |
| CDN | $0 | Cloudflare free |
| Redis | $0 | Self-host |
| Domain | $0 | Existing domain |
| **รวม** | **$10-12 (~350-420 บาท)** |

### 3.3 Prod Cost — แผน B (R2)

| Component | Cost/เดือน | Notes |
|-----------|-------------|-------|
| VPS 2vCPU/2GB | $10-12 | Same |
| R2 Storage (1-2GB) | $0.5-1 | $0.015/GB |
| R2 Requests | ~$0.05 | ~10k/month |
| CDN | $0 | R2 egress free via CF |
| Workers (optional) | $0-5 | Image resize proxy |
| **รวม** | **$10.5-18 (~370-630 บาท)** |

### 3.4 Scale Cost

| Traffic | Cost เพิ่ม | สาเหตุ |
|---------|-----------|--------|
| 100+ users | +$5-10 | VPS upgrade to 4GB หรือ R2 requests เยอะขึ้น |
| 500+ users | +$15-25 | VPS 4vCPU, CDN traffic, R2 egress |
| 1000+ users | +$30-50 | Consider dedicated encode worker |

---

## 4. FFmpeg Config

### 4.1 Encode Settings

```bash
# Output: MP4 H.264
ffmpeg -i input.mp4 \
  -c:v libx264 \
  -crf 28 \
  -preset fast \
  -max_muxing_queue_size 16 \
  -threads 2 \
  -movflags +faststart \
  -progress pipe:1 \
  output.mp4
```

**Settings Explained:**

| Flag | Value | เหตุผล |
|------|-------|--------|
| `-crf 28` | Quality ~70-80% | Balance quality + size |
| `-preset fast` | Speed vs compression | เร็วพอสำหรับ 50MB video |
| `-threads 2` | 2 threads | Match 2 vCPU |
| `-movflags +faststart` | Streaming ready | Video เล่นได้เลย ไม่ต้องโหลดทั้งหมด |

### 4.2 Timeout + Safety

```typescript
// Worker config
{
  timeout: 90000,          // 90s timeout
  maxAttempts: 2,          // retry 2 ครั้ง
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
}

// ถ้า FFmpeg crash
// → mark status = "failed"
// → notify user
// → cleanup temp files
```

### 4.3 Thumbnail Generation

```bash
# Extract 1 frame at 1 second (หรือ 10% of video)
ffmpeg -i input.mp4 \
  -ss 00:00:01 \
  -vframes 1 \
  -q:v 2 \
  -vf "scale=640:-1" \
  thumbnail.jpg
```

---

## 5. Database Schema

### 5.1 Video Model

```typescript
// เพิ่มใน schema.prisma
model Video {
  id        String   @id @default(cuid())
  postId    String   @unique
  originalUrl String?
  videoUrl   String?   // URL หลัง encode เสร็จ
  thumbnailUrl String?
  status    String   @default("pending") // pending | processing | ready | failed
  error     String?
  size      Int?     // bytes
  duration  Int?     // seconds
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  post      Post     @relation(fields: [postId], references: [id])
}
```

### 5.2 Post Model (Update)

```typescript
model Post {
  // ... existing fields
  hasMedia   Boolean  @default(false)
  mediaType  String?  // "image" | "video"
  // video relation
  video      Video?
}
```

---

## 6. API Endpoints

### 6.1 Upload Video

```
POST /api/upload/video
Content-Type: multipart/form-data

Request:
  - file: video file (max 50MB)

Response (201):
{
  "tempId": "temp_abc123",
  "status": "uploaded"
}

Errors:
  - 400: Invalid file type
  - 413: File too large
  - 500: Upload failed
```

### 6.2 Create Post with Video

```
POST /api/posts
Content-Type: application/json

Request:
{
  "content": "...",
  "videoTempId": "temp_abc123"
}

Response (201):
{
  "id": "post_xyz",
  "videoStatus": "processing"
}
```

### 6.3 Get Video Status

```
GET /api/videos/:id/status

Response (200):
{
  "status": "processing" | "ready" | "failed",
  "videoUrl": "..." (ถ้า ready),
  "thumbnailUrl": "..." (ถย ready),
  "error": "..." (ถ้า failed)
}
```

### 6.4 Delete Post (Soft Delete)

```
DELETE /api/posts/:id

Response (200):
{
  "deleted": true,
  "cleanupScheduled": true
}
```

---

## 7. Implementation Order

### Phase 1: Core (Local Dev)
| # | งาน | เวลาโดยประมาณ | Priority |
|---|------|----------------|----------|
| 1 | Database schema (Video model) | 15 นาที | P0 |
| 2 | Upload API route | 30 นาที | P0 |
| 3 | BullMQ setup + FFmpeg worker | 1-2 ชม. | P0 |
| 4 | Video status endpoint | 15 นาที | P0 |
| 5 | Frontend upload UI | 30 นาที | P0 |
| 6 | Polling + video display | 30 นาที | P0 |
| 7 | Click-to-play setup | 15 นาที | P0 |
| 8 | Local UAT | 1 ชม. | P0 |

### Phase 2: Soft Delete
| # | งาน | เวลาโดยประมาณ | Priority |
|---|------|----------------|----------|
| 9 | Soft delete API | 15 นาที | P1 |
| 10 | Cleanup worker | 30 นาที | P1 |
| 11 | Cron job (daily cleanup) | 30 นาที | P2 |

### Phase 3: Production Ready
| # | งาน | เวลาโดยประมาณ | Priority |
|---|------|----------------|----------|
| 12 | VPS setup + Docker | 30 นาที | P1 |
| 13 | Cloudflare CDN setup | 15 นาที | P1 |
| 14 | CDN headers config | 15 นาที | P1 |
| 15 | Production UAT | 1 ชม. | P1 |

### Phase 4: Optional R2 (อัพเกรด)
| # | งาน | เวลาโดยประมาณ | Priority |
|---|------|----------------|----------|
| 16 | R2 bucket setup | 15 นาที | P2 |
| 17 | Storage service abstraction | 1 ชม. | P2 |
| 18 | R2 integration | 1 ชม. | P2 |

---

## 8. Key Pitfalls (Lessons from GPT)

### ⚠️ FFmpeg Timeout
- **อย่าใช้ 60s** — worst-case encode > 60s ได้จริงบน VPS CPU ต่ำ
- **ใช้ 90s** — เผื่อเยอะพอ ไม่ต้อง 120s+ เพราะ click-to-play + concurrency=1 = queue ไม่หนาแ่น

### ⚠️ Concurrency
- **ต้องเป็น 1** — FFmpeg ใช้ CPU 100% ต่อ process
- 2 jobs พร้อมกัน = CPU spike แน่นอน → timeout

### ⚠️ Polling
- **อย่าตั้ง 3s ทุก poll เสมอ** — เปลือง API + DB
- **ใช้ backoff:** 3s → 5s → 10s → stop
- **Stop ทันที** เมื่อ status = ready/failed

### ⚠️ Soft Delete Order
- **ลำดับที่ถูก:** mark deletedAt → enqueue cleanup → delete files
- ถ้าลบไฟล์ก่อน → post ยัง active แต่ video หาย

### ⚠️ R2 CDN
- **Immutable URL** สำคัญมาก — เปลี่ยน URL ทีต้อง cache bust
- **Cache-Control headers** ต้องตั้งตอน upload ไม่ใช่หลัง

---

## 9. Monitoring & Observability

### 9.1 Logs to Track
```typescript
// FFmpeg worker
logger.info('Video encoding started', { videoId, postId })
logger.info('Video encoding completed', { videoId, duration })
logger.error('Video encoding failed', { videoId, error })

// Queue
logger.info('Job queued', { jobId, type })
logger.info('Job completed', { jobId, duration })
logger.error('Job failed', { jobId, error, attempts })
```

### 9.2 Metrics to Monitor
- Queue length (BullMQ dashboard)
- FFmpeg encode duration (avg, p95)
- Failed encode rate
- Storage usage (/uploads)
- CDN cache hit ratio (ถ้าใช้ R2)

---

## 10. Security Considerations

### 10.1 File Validation
```typescript
// Allowed MIME types
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

// Max size: 50MB
const MAX_SIZE = 50 * 1024 * 1024

// Validate ทั้ง client + server
// เพราะ client validation หลอกได้
```

### 10.2 Video Processing Security
```typescript
// ใช้ -progress pipe:1 แทน file output
// ป้องกัน FFmpeg command injection

// ตรวจสอบ file signature (magic bytes)
const MAGIC_BYTES = {
  'mp4': [0x00, 0x00, 0x00],
  'ftyp': [0x66, 0x74, 0x79, 0x70],
}
```

---

## 11. References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [FFmpeg H.264 Encoding Guide](https://trac.ffmpeg.org/wiki/Encode/H.264)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/platform/pricing/)
- [Cloudflare Cache Rules](https://developers.cloudflare.com/cache/)

---

## 12. Appendix: Architecture Diagrams

### Full System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEXUS SOCIAL — VIDEO SYSTEM                 │
│                                                                  │
│  ┌──────────┐     ┌──────────────┐     ┌───────────────────┐   │
│  │  Client  │────►│  Next.js API │────►│  PostgreSQL DB    │   │
│  │ (Upload) │     │  (Upload +   │     │  • Post table     │   │
│  │          │◄────│   Posts)     │◄────│  • Video table    │   │
│  └──────────┘     └──────┬───────┘     └───────────────────┘   │
│         │                │                                        │
│         │          ┌─────▼───────┐                                │
│         │          │  BullMQ +   │                                │
│         │          │  Redis      │                                │
│         │          │  (Queue)    │                                │
│         │          └─────┬───────┘                                │
│         │                │                                        │
│         │          ┌─────▼───────┐                                │
│         │          │  FFmpeg     │                                │
│         │          │  Worker     │                                │
│         │          └─────┬───────┘                                │
│         │                │                                        │
│         │          ┌─────▼───────┐     ┌───────────────────┐   │
│         │          │  Storage    │◄────│  Cloudflare CDN   │   │
│         │          │  (Local /   │────►│  (Cache + Proxy)  │   │
│         │          │   R2)       │     └───────────────────┘   │
│         │          └─────────────┘                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

**Document Status:** Draft
**Next Review:** After Phase 1 implementation
**Changes:** Will be updated as implementation progresses
