# Nexus Social — SSOT 100% Implementation Plan

> **สำหรับ Hermes:** ใช้ subagent-driven-development เพื่อ execute task-by-task
>
> **Goal:** ทำให้ Nexus Social เป็น Single Source of Truth สมบูรณ์ — ข้อมูลทุกอย่างมาจากที่เดียว ตรวจสอบง่าย ไม่มั่ว ไม่พัง
>
> **หลักการ:** PostgreSQL = SSOT หลัก, Redis = ephemeral cache/job-queue เท่านั้น (ไม่เคยเป็น SSOT), File system = media storage (ถูก reference โดย DB)

---

## สถานะปัจจุบัน: SSOT กี่%?

| ส่วน | Status | หมายเหตุ |
|---|---|---|
| Post content + relations | ✅ ~98% | มี denormalized count drift risk |
| Follow relations | ✅ 100% | Junction table เดียว |
| Chat messages | ✅ ~95% | delivery ไม่ guaranteed |
| Notifications | ✅ 100% | DB อย่างเดียว |
| User accounts | ✅ 100% | |
| Video metadata | ✅ ~95% | status tracking ดี แต่ recovery มี edge case |
| Image/Avatar uploads | ✅ ~90% | URL in DB, file on disk |
| **Auth tokens** | ⚠️ ~70% | Token อยู่ localStorage (ephemeral), ไม่มี refresh |
| **Post counts (likes/reposts)** | ⚠️ ~80% | Denormalized field + live _count mix |
| **Profile total likes** | ⚠️ ~70% | 3 queries ต่อ profile load |
| **Redis usage** | ⚠️ | ใช้ BullMQ แล้ว (ดี), แต่ยังไม่มี pub/sub สำหรับ chat |
| **Count reconciliation** | ❌ 0% | ไม่มี cron ตรวจสอบ drift |
| **File storage integrity** | ❌ 0% | ไม่มี orphaned URL detection |
| **Auth `/auth/me` response** | ⚠️ | ไม่มี `token` field → client ต้องเก็บ token แยก |

---

## Root Cause Analysis ของแต่ละปัญหา

### 🔴 Issue 1: Auth Token /auth/me Gap
**สาเหตุ:** Backend ส่ง `{ token, user }` จาก login/register แต่ `/auth/me` ส่งแค่ user object (ไม่มี `token` field)

**ผลกระทบ:**
- Client ต้องเก็บ `token` ใน localStorage แยก — เป็น ephemeral copy
- ถ้า localStorage ถูก clear (private browsing, storage quota exceeded) → user หลุดทันที
- ไม่มี token rotation mechanism → token หมดอายุ 7 วัน → user logout โดยไม่รู้ตัว

**วิธีแก้:** เพิ่ม `token` field ใน `/auth/me` response → localStorage ยังคงใช้อยู่ (เป็น optimiztion) แต่ SSOT ยังเป็น JWT ใน backend

---

### 🔴 Issue 2: Denormalized Count Drift (likesCount / repostsCount)
**สาเหตุ:** `Post.likesCount` (Int) เป็น denormalized field ที่ต้อง sync กับ `COUNT(Like table)` ทุกครั้งที่ like/unlike

**ปัญหาเฉพาะใน code:**
```typescript
// posts.service.ts:94-99 — ไม่มี transaction wrapping
await this.prisma.like.deleteMany({ where: { userId, postId } });
await this.prisma.post.update({
  where: { id: postId },
  data: { likesCount: { decrement: 1 } },
  select: { _count: { select: { likes: true } } },  // ← query นี้ไม่ได้ใช้!
});
```
1. ถ้า `deleteMany` สำเร็จแต่ `update` ล้มเหลว → Like record หายแต่ count ไม่ลด
2. `select: { _count }` ใช้แต่ไม่เคยตรวจสอบ → drift ไม่ถูก detect
3. ไม่มี cron ตรวจสอบ drift ทั่วระบบ

**วิธีแก้:**
- ทุก toggle ใช้ Prisma `$transaction`
- เพิ่ม Reconciliation cron ที่ sync denormalized counts กับ actual counts
- เปลี่ยน response ให้ return `_count.likes` แทน `likesCount` เสมอ

---

### 🔴 Issue 3: Profile totalLikesReceived — 3 Queries ต่อ Load
**สาเหตุ:** `getProfile()` ทำ 3 queries แยก:
1. `findUnique` → get all posts + `_count.likes`
2. `reduce()` sum ขึ้นมาใน JS (ไม่ใช้ SQL)
3. Extra `COUNT()` query สำหรับ `likesToday`

**ผลกระทบ:** N+1 query problem — user ที่มี 1000 posts = 1000 post objects + 1000 `_count.likes` → RAM heavy, latency สูง

**วิธีแก้:**
- Denormalize `likesCount` field ใน Post table (มีอยู่แล้ว ✓) — ใช้ `SUM(likesCount)` แทน `COUNT(Like)`
- สำหรับ total: `SELECT SUM(likesCount) FROM Post WHERE userId = X AND deletedAt IS NULL`
- สำหรับ today: `COUNT(Like)` อย่างเดียว (เพราะ `likesCount` ไม่มี timestamp)

---

### 🟠 Issue 4: Redis ใช้แค่ BullMQ — ไม่มี Pub/Sub สำหรับ Chat
**สาเหตุ:** Redis ถูกใช้แล้วสำหรับ BullMQ video queues (ดี) แต่ Socket.IO chat ยัง broadcast โดยตรง

**ผลกระทบ:**
- ถ้า server restart → socket reconnect กลับมา → message ที่ส่งระหว่าง restart หาย
- ถ้า server มีหลาย instances (scale horizontally) → user A บน server 1 ส่งไป user B บน server 2 → user B ไม่ได้รับ

**วิธีแก้:**
- ใช้ Redis Adapter สำหรับ Socket.IO → cross-server broadcasting
- หรือใช้ Redis pub/sub เป็น message broker ระหว่าง Socket.IO instances

---

### 🟠 Issue 5: File Storage Integrity — No Orphaned URL Detection
**สาเหตุ:** PostgreSQL เก็บ URL (เช่น `http://localhost:3001/uploads/posts/abc.webp`) แต่ file อยู่บน disk

**ผลกระทบ:**
- ถ้า disk full, disk corruption, หรือ deploy ผิด path → URL ใน DB ชี้ไปไฟล์ที่ไม่มี
- ไม่มี cron ตรวจสอบว่า media URL ทั้งหมด accessible

**วิธีแก้:**
- เพิ่ม `isAvailable` boolean field ใน Post (optional) หรือ
- Health check cron ที่ ping ทุก media URL ที่ใช้งานอยู่ ทุก 6 ชั่วโมง
- เก็บ media metadata ใน DB (filename, size, mimeType, checksum) เพื่อ verify integrity

---

### 🟡 Issue 6: Video Encoding Recovery — Edge Case
**สาเหตุ:** BullMQ มี built-in retry (2 attempts) + lock renewal แล้ว แต่ถ้า **Redis connection ล้ม** ระหว่าง encoding:
- Job ติดอยู่ใน active state
- Client poll ไปเรื่อยๆ ไม่มีวันได้ status = ready

**ผลกระทบ:** Video "processing" ถาวร → user เห็นว่าวิดีโอกำลัง encode ไม่รู้จบ

**วิธีแก้:**
- เพิ่ม `maxProcessingAge` cron — ถ้า video มี status='processing' นานกว่า 5 นาที → reset เป็น 'failed' + re-enqueue job
- หรือใช้ Redis key expiration สำหรับ processing lock → ถ้า worker ตาย, key หมดอายุ → cron ตรวจเจอ

---

### 🟡 Issue 7: Auth Token — No Refresh Mechanism
**สาเหตุ:** JWT token มีอายุ 7 วัน แต่ไม่มี refresh token → user หลุดเมื่อ token หมดอายุ

**ผลกระทบ:**
- localStorage หรือ cookie หมดอายุ → logout โดยไม่ได้ตั้งใจ
- ไม่มี way เพื่อ revoke token ทันที (เช่น user เปลี่ยน password)

**วิธีแก้:**
- เพิ่ม Redis-backed refresh token (short-lived, e.g. 1 ชม.)
- หรือใช้ cookie-based JWT ที่ auto-refresh ทุก request

---

## Implementation Plan

### Phase 1: Quick Wins — ลด Drift, ปรับ Response (2-3 วัน)

#### Task 1.1: Fix `/auth/me` response — เพิ่ม token field
**Objective:** `/auth/me` ส่ง token กลับมาด้วย

**Files:**
- `server/src/auth/auth.service.ts:92-127` — แก้ `me()` method

**Step 1:** อ่าน file ปัจจุบัน
```
read_file: server/src/auth/auth.service.ts:92-127
```

**Step 2:** เปลี่ยน `me()` ให้ accept token parameter
```typescript
async me(userId: string, token?: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { /* same as before */ }
  });
  if (!user) throw new UnauthorizedException('User not found');

  return {
    ...user,
    followersCount: user._count.followers,
    followingCount: user._count.following,
    postsCount: user._count.posts,
    token: token ?? null,  // ← เพิ่มบรรทัดนี้
  };
}
```

**Step 3:** แก้ controller ให้ pass token
```typescript
@Get('me')
@UseGuards(JwtAuthGuard)
async me(@Request() req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  return this.authService.me(req.user.id, token);
}
```

**Step 4:** Test — เรียก `GET /auth/me` ด้วย token → response ต้องมี `token` field

**Verification:**
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/auth/me
# Expected: response มี field "token": "<same-jwt>"
```

**Commit:** `git add server/src/auth && git commit -m "fix(auth): add token to /auth/me response for client convenience"`

---

#### Task 1.2: Wrap toggleLike/toggleRepost in Prisma transaction
**Objective:** ป้องกัน count drift จาก partial failure

**Files:**
- `server/src/posts/posts.service.ts:86-130` — `toggleLike()`
- `server/src/posts/posts.service.ts` — `toggleRepost()` (ถ้ามี)

**Step 1:** อ่าน `toggleLike` เต็มๆ
```
read_file: server/src/posts/posts.service.ts:86-200
```

**Step 2:** แก้ `toggleLike` ใช้ `$transaction`
```typescript
async toggleLike(userId: string, postId: string) {
  const existing = await this.prisma.like.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    // UNLIKE: ทำใน transaction เดียวกัน
    const [, , deletedNotif] = await this.prisma.$transaction([
      this.prisma.like.deleteMany({ where: { userId, postId } }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
      }),
      this.prisma.notification.deleteMany({
        where: { type: 'LIKE', actorId: userId, postId },
      }),
    ]);
    const updated = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { likesCount: true, _count: { select: { likes: true } } },
    });
    // Verification: if drift detected, fix it
    if (updated && updated.likesCount !== updated._count.likes) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { likesCount: updated._count.likes },
      });
      return { isLiked: false, likesCount: updated._count.likes };
    }
    return { isLiked: false, likesCount: updated?.likesCount ?? 0 };
  } else {
    // LIKE: ทำใน transaction เดียวกัน
    const [, , notif] = await this.prisma.$transaction([
      this.prisma.like.create({ data: { userId, postId } }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
      }),
      // notification creation (separate, non-blocking)
      this.prisma.notification.create({
        data: { /* ... */ },
      }).catch(() => {}),  // non-critical
    ]);
    const updated = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { likesCount: true },
    });
    return { isLiked: true, likesCount: updated?.likesCount ?? 0 };
  }
}
```

**Step 3:** ทำเหมือนกันสำหรับ `toggleRepost` (ถ้ามี method แยก) หรือ logic repost

**Verification:** ดูที่ `posts.service.ts` หา `toggleRepost` หรือ `repost` logic ก่อน

**Commit:** `git add server/src/posts && git commit -m "fix(posts): wrap toggleLike in $transaction with drift verification"`

---

#### Task 1.3: Optimize Profile totalLikesReceived — ลดจาก 3 queries เป็น 1
**Objective:** ใช้ SQL aggregation แทน JS reduce

**Files:**
- `server/src/users/users.service.ts:7-95` — `getProfile()`

**Step 1:** อ่าน `getProfile()` เต็มๆ
```
read_file: server/src/users/users.service.ts:1-95
```

**Step 2:** เปลี่ยน totalLikesReceived ใช้ SQL SUM
```typescript
// แทน: user.posts.reduce((sum, p) => sum + p._count.likes, 0)

// ใช้: SQL aggregation
const likesAggregation = await this.prisma.post.aggregate({
  where: { userId: user.id, deletedAt: null },
  _sum: { likesCount: true },
});
const totalLikesReceived = likesAggregation._sum.likesCount ?? 0;
```

**Step 3:** แก้ response structure ให้ส่ง `totalLikesReceived` (Int) แทน computed value

**Verification:**
```bash
# เรียก GET /users/{username} → response.totalLikesReceived ต้องเป็น Int ไม่ใช่ computed array
# Benchmark: profile load ควรเร็วขึ้น 50%+ สำหรับ user ที่มี posts เยอะ
```

**Commit:** `git add server/src/users && git commit -m "perf(users): use SQL SUM for totalLikesReceived instead of JS reduce"`

---

### Phase 2: Reconciliation & Integrity (3-4 วัน)

#### Task 2.1: สร้าง Count Reconciliation Cron
**Objective:** Scheduled job ที่ตรวจสอบและ fix denormalized count drift

**Files:**
- Create: `server/src/maintenance/count-reconciliation.service.ts`
- Modify: `server/src/app.module.ts` — import MaintenanceModule

**Step 1:** สร้าง service
```typescript
// server/src/maintenance/count-reconciliation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CountReconciliationService {
  private readonly logger = new Logger(CountReconciliationService.name);

  constructor(private prisma: PrismaService) {}

  // รันทุกวันตอนเที่ยงคืน
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async reconcileAll() {
    this.logger.log('[Reconciliation] Starting daily count reconciliation...');
    
    const postResults = await this.reconcilePostCounts();
    this.logger.log(`[Reconciliation] Fixed ${postResults} post count drifts`);
    
    return { postDriftsFixed: postResults };
  }

  async reconcilePostCounts(): Promise<number> {
    const posts = await this.prisma.post.findMany({
      select: { id: true, likesCount: true },
    });

    let fixed = 0;
    for (const post of posts) {
      const actualCount = await this.prisma.like.count({
        where: { postId: post.id },
      });

      if (post.likesCount !== actualCount) {
        this.logger.warn(
          `[Reconciliation] Post ${post.id.slice(-8)}: likesCount=${post.likesCount} → actual=${actualCount}`
        );
        await this.prisma.post.update({
          where: { id: post.id },
          data: { likesCount: actualCount },
        });
        fixed++;
      }
    }

    return fixed;
  }

  // Manual trigger for testing
  async reconcileSingle(postId: string) {
    const actual = await this.prisma.like.count({ where: { postId } });
    return this.prisma.post.update({
      where: { id: postId },
      data: { likesCount: actual },
      select: { likesCount: true },
    });
  }
}
```

**Step 2:** เพิ่ม MaintenanceModule ใน app.module.ts
```typescript
// ใน app.module.ts imports
import { MaintenanceModule } from './maintenance/maintenance.module';

@Module({
  imports: [
    // ... existing modules
    MaintenanceModule,
  ],
})
```

**Step 3:** Verify — ดู logs หลัง midnight หรือเรียก manual trigger

**Commit:** `git add server/src/maintenance && git commit -m "feat(maintenance): add count reconciliation cron"`

---

#### Task 2.2: สร้าง Video Stale Processing Recovery Cron
**Objective:** ป้องกัน video "processing" ถาวร

**Files:**
- `server/src/video/video-cleanup.service.ts` — เพิ่ม method ใหม่

**Step 1:** เพิ่ม cron ใน `VideoCleanupService`
```typescript
// ใน video-cleanup.service.ts

// รันทุก 10 นาที — ตรวจ video ที่ค้างอยู่ในสถานะ processing นานเกินไป
@Cron('*/10 * * * *')  // Every 10 minutes
async recoverStaleProcessing() {
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

  const staleVideos = await this.prisma.video.findMany({
    where: {
      status: 'processing',
      updatedAt: { lt: staleThreshold },
    },
  });

  if (staleVideos.length === 0) return;

  this.logger.warn(`[Recovery] Found ${staleVideos.length} stale processing videos`);

  for (const video of staleVideos) {
    this.logger.warn(`[Recovery] Resetting stale video ${video.id.slice(-8)} to failed`);
    
    // Reset to failed
    await this.prisma.video.update({
      where: { id: video.id },
      data: { status: 'failed', error: 'Processing timeout — auto-reset by recovery cron' },
    });

    // Re-enqueue for retry
    const videoService = /* get VideoService instance */;
    // หรือใช้ BullMQ connection ตรง
    await this.enqueueRecoveryJob(video.id);
  }
}
```

**Step 2:** เพิ่ม `enqueueRecoveryJob` private method
```typescript
private async enqueueRecoveryJob(videoId: string) {
  const { Queue } = require('bullmq');
  const recoveryQueue = new Queue('video-processing', {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  });
  await recoveryQueue.add('process-video', { videoId });
  await recoveryQueue.close();
}
```

**Verification:** 
1. Start video upload, kill VideoProcessor worker
2. Wait 5+ minutes
3. Check: video status = 'failed', cron log แสดง recovery action

**Commit:** `git add server/src/video && git commit -m "fix(video): add stale processing recovery cron"`

---

#### Task 2.3: สร้าง Media Integrity Health Check
**Objective:** ตรวจสอบว่า media URL ที่เก็บใน DB ยัง accessible อยู่

**Files:**
- Create: `server/src/maintenance/media-integrity.service.ts`
- Modify: `server/src/maintenance/count-reconciliation.service.ts` — combine or separate

**Step 1:** สร้าง service
```typescript
// server/src/maintenance/media-integrity.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class MediaIntegrityService {
  private readonly logger = new Logger(MediaIntegrityService.name);
  private readonly BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

  // รันทุก 6 ชั่วโมง
  @Cron('0 */6 * * *')
  async checkMediaIntegrity() {
    this.logger.log('[MediaIntegrity] Starting health check...');
    
    // ดึง mediaUrls ที่ใช้งานจริงจาก posts 7 วันล่าสุด
    const recentPosts = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        mediaUrls: { isEmpty: false },
      },
      select: { id: true, mediaUrls: true },
    });

    let checked = 0;
    let failed = 0;

    for (const post of recentPosts) {
      for (const url of post.mediaUrls) {
        try {
          const fullUrl = url.startsWith('http') ? url : `${this.BASE_URL}${url}`;
          await axios.head(fullUrl, { timeout: 5000 });
          checked++;
        } catch {
          failed++;
          this.logger.warn(`[MediaIntegrity] FAILED: ${url} (post ${post.id.slice(-8)})`);
        }
      }
    }

    this.logger.log(`[MediaIntegrity] Done — checked: ${checked}, failed: ${failed}`);
    return { checked, failed };
  }
}
```

**Step 2:** เพิ่ม MediaIntegrityService ใน MaintenanceModule

**Verification:** Run manually, check logs for failed URLs

**Commit:** `git add server/src/maintenance && git commit -m "feat(maintenance): add media integrity health check cron"`

---

### Phase 3: Redis Pub/Sub สำหรับ Chat (5-7 วัน)

#### Task 3.1: Integrate Socket.IO Redis Adapter
**Objective:** ให้ Socket.IO กระจาย events ข้าม server instances

**Files:**
- `server/package.json` — เพิ่ม `@socket.io/redis-adapter`
- `server/src/main.ts` — ตั้งค่า Redis adapter
- `server/src/chat/chat.gateway.ts` — ใช้ adapter สำหรับ broadcast

**Step 1:** Install package
```bash
cd /workspace/workspace/server
npm install @socket.io/redis-adapter
```

**Step 2:** แก้ main.ts
```typescript
// server/src/main.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Setup Redis adapter for Socket.IO
  const pubClient = createClient({
    socket: { host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT) },
  });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  const server = app.getHttpServer();
  const io = new Server(server);
  io.adapter(createAdapter(pubClient, subClient));

  // ... rest of bootstrap
}
```

**Step 3:** Update ChatGateway สำหรับ cross-server messaging
```typescript
// ใน chat.gateway.ts — เปลี่ยน broadcast ใช้ Redis
// แทน: this.server.to(`conversation:${id}`).emit(...)
// ใช้: this.server.to(`conversation:${id}`).emit(...) // Socket.IO Redis adapter จัดการให้
```

**Step 4:** Verify — ต้องมี Redis รันอยู่ → restart server → socket ทำงานปกติ

**Commit:** `git add server/package.json server/src/main.ts server/src/chat && git commit -m "feat(chat): integrate Socket.IO Redis adapter for horizontal scaling"`

---

#### Task 3.2: Guaranteed Message Delivery
**Objective:** ถ้า socket disconnect ระหว่างส่ง → message ไม่หาย

**Files:**
- `server/src/chat/chat.gateway.ts` — เพิ่ม acknowledgment
- `server/src/chat/chat.service.ts` — เพิ่ม `sendWithAck()`

**Step 1:** เพิ่ม ack pattern
```typescript
// server/src/chat/chat.gateway.ts
@SubscribeMessage('send_message')
async handleSendMessage(
  @MessageBody() data: { conversationId: string; content: string; clientId: string },
  @ConnectedSocket() client: Socket,
) {
  // Save to DB first (SSOT)
  const message = await this.chatService.createMessage({
    conversationId: data.conversationId,
    senderId: client.data.userId,
    content: data.content,
    clientId: data.clientId,
  });

  // Emit with ack — client ต้อง confirm
  return { success: true, messageId: message.id, serverTimestamp: message.createdAt };
}

// Client side: รอ ack ก่อนถือว่าส่งสำเร็จ
socket.emit('send_message', data, (ack) => {
  if (ack.success) {
    setMessageStatus(data.clientId, 'delivered');
  } else {
    // Retry หรือแจ้ง error
    setMessageStatus(data.clientId, 'failed');
  }
});
```

**Step 2:** เพิ่ม retry queue สำหรับ disconnected clients
```typescript
// server/src/chat/chat.service.ts
async createMessage(data) {
  const message = await this.prisma.message.create({ data });
  
  // Emit via Socket.IO
  this.chatGateway.emitToConversation(data.conversationId, 'new_message', message);

  // If client is offline → store in "pending" table
  // When client reconnects → deliver pending messages
  return message;
}
```

**Commit:** `git add server/src/chat && git commit -m "feat(chat): add message acknowledgment for guaranteed delivery"`

---

### Phase 4: Auth Refresh Token (5-7 วัน)

#### Task 4.1: Implement Redis-backed Refresh Token
**Objective:** Auto-refresh JWT ก่อนหมดอายุ

**Files:**
- Create: `server/src/auth/refresh-token.service.ts`
- Modify: `server/src/auth/auth.service.ts`
- Modify: `server/src/auth/dto/auth.dto.ts`

**Step 1:** สร้าง RefreshTokenService
```typescript
// server/src/auth/refresh-token.service.ts
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RefreshTokenService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = require('crypto').randomBytes(64).toString('hex');
    // TTL: 30 days
    await this.redis.set(`refresh:${token}`, userId, 'EX', 30 * 24 * 60 * 60);
    return token;
  }

  async validateRefreshToken(token: string): Promise<string | null> {
    return this.redis.get(`refresh:${token}`);
  }

  async revokeRefreshToken(token: string) {
    await this.redis.del(`refresh:${token}`);
  }

  async revokeAllUserTokens(userId: string) {
    // Scan Redis for all tokens belonging to this user
    const keys = await this.redis.keys(`refresh:*`);
    for (const key of keys) {
      const uid = await this.redis.get(key);
      if (uid === userId) await this.redis.del(key);
    }
  }
}
```

**Step 2:** เพิ่ม `POST /auth/refresh` endpoint
```typescript
@Post('refresh')
async refresh(@Body() dto: { refreshToken: string }) {
  const userId = await this.refreshTokenService.validateRefreshToken(dto.refreshToken);
  if (!userId) throw new UnauthorizedException('Invalid refresh token');
  
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  const newAccessToken = this.generateToken(user.id);
  const newRefreshToken = await this.refreshTokenService.createRefreshToken(userId);
  
  return { accessToken: newAccessToken, refreshToken: newRefreshToken, user };
}
```

**Step 3:** แก้ client ให้ auto-refresh
```typescript
// client/src/lib/api.ts
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try refresh token
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('token', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        // Retry original request
        error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return axios(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```

**Commit:** `git add server/src/auth server/src/auth/refresh-token.service.ts client/src/lib/api.ts && git commit -m "feat(auth): add refresh token mechanism with Redis backend"`

---

## Execution Order

```
Week 1: Phase 1 (Quick Wins)
  → Task 1.1 → Task 1.2 → Task 1.3

Week 2: Phase 2 (Reconciliation & Integrity)
  → Task 2.1 → Task 2.2 → Task 2.3

Week 3-4: Phase 3 (Redis Pub/Sub)
  → Task 3.1 → Task 3.2

Week 5-6: Phase 4 (Auth Refresh Token)
  → Task 4.1
```

## SSOT Target หลัง Implement ทั้งหมด

| ส่วน | ก่อน | หลัง |
|---|---|---|
| Post content | ~98% | ✅ 100% |
| Post counts | ~80% | ✅ 100% |
| Follow relations | ✅ 100% | ✅ 100% |
| Chat messages | ~95% | ✅ 99% |
| Notifications | ✅ 100% | ✅ 100% |
| Video metadata | ~95% | ✅ 99% |
| Auth tokens | ~70% | ✅ 95% |
| Profile total likes | ~70% | ✅ 99% |
| File storage integrity | ❌ 0% | ✅ 90% |
| **รวม** | **~80%** | **~98%** |
