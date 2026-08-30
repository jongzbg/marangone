# SSOT Fix — Testing Guide (Manual + Automated)

> **วัตถุประสงค์:** ทดสอบทุก fix ให้ครบทุกมิติ โดยไม่ทำระบบพัง
>
> **สมมติ:** Server รันที่ `http://localhost:3001`, มี test users 2 ตัว: Alice (`alice@test.com`) และ Bob (`bob@test.com`)

---

## ก่อนทดสอบ — Setup

### 1. เปิด 3 terminal พร้อมกัน

```bash
# Terminal 1: Server logs
cd /workspace/workspace/server
npm run start 2>&1 | grep -E "\[|ERROR|WARN|Recovery|Reconciliation|Media"

# Terminal 2: Server full logs (สำหรับดู detail)
cd /workspace/workspace/server
npm run start

# Terminal 3: สำหรับ curl commands
```

### 2. เตรียม test data

```bash
# Register Alice
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"Test1234!","username":"alice","displayName":"Alice"}'

# Register Bob
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@test.com","password":"Test1234!","username":"bob","displayName":"Bob"}'

# Login Alice → เก็บ token
ALICE_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"Test1234!"}' \
  | jq -r '.token')

# Login Bob
BOB_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@test.com","password":"Test1234!"}' \
  | jq -r '.token')

echo "Alice: $ALICE_TOKEN"
echo "Bob: $BOB_TOKEN"
```

---

## Task 1.1: `/auth/me` — Token Field

### ✅ Test 1.1.1: `/auth/me` คืน token field

```bash
curl -s -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  | jq
```

**Expected Response:**
```json
{
  "id": "...",
  "username": "alice",
  "token": "eyJhbGciOiJIUzI1NiIs..."   // ← ต้องมี field นี้
}
```

**Pass:** มี `"token": "..."` field
**Fail:** ไม่มี token field, หรือ undefined

---

### ✅ Test 1.1.2: Login ยังคงคืน token ปกติ

```bash
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"Test1234!"}' \
  | jq '{token: .token, user: .user.username}'
```

**Expected:** `{ "token": "eyJ...", "user": "alice" }`

---

### ✅ Test 1.1.3: Token จาก `/auth/me` สามารถใช้ต่อได้

```bash
# เอา token จาก /auth/me มาใช้เรียก /users/alice
ME_TOKEN=$(curl -s http://localhost:3001/auth/me \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq -r '.token')

curl -s http://localhost:3001/users/alice \
  -H "Authorization: Bearer $ME_TOKEN" | jq '.username'
```

**Expected:** `"alice"` (ใช้ได้)

---

## Task 1.2: toggleLike/toggleRepost — $transaction + Drift Fix

### ✅ Test 1.2.1: Like แล้ว count เพิ่มถูกต้อง

```bash
# Alice สร้าง post
POST=$(curl -s -X POST http://localhost:3001/posts \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test post for like counting"}')
POST_ID=$(echo $POST | jq -r '.id')
echo "Post ID: $POST_ID"

# Alice like post ของตัวเอง (ควรได้ likesCount = 1)
LIKE_RESULT=$(curl -s -X POST "http://localhost:3001/posts/$POST_ID/like" \
  -H "Authorization: Bearer $ALICE_TOKEN")
echo "Like result: $LIKE_RESULT"
```

**Expected:**
```json
{ "isLiked": true, "liked": true, "likesCount": 1 }
```

---

### ✅ Test 1.2.2: Unlike แล้ว count ลดถูกต้อง

```bash
# Alice unlike
curl -s -X POST "http://localhost:3001/posts/$POST_ID/like" \
  -H "Authorization: Bearer $ALICE_TOKEN"
```

**Expected:**
```json
{ "isLiked": false, "liked": false, "likesCount": 0 }
```

---

### ✅ Test 1.2.3: Bob like → Alice เห็น count = 1  (cross-user test)

```bash
# Bob like Alice's post
curl -s -X POST "http://localhost:3001/posts/$POST_ID/like" \
  -H "Authorization: Bearer $BOB_TOKEN"

# Verify via GET post
curl -s "http://localhost:3001/posts/$POST_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq '{likesCount, isLiked}'
```

**Expected:** `likesCount: 1, isLiked: true` (สำหรับ Alice)

---

### ✅ Test 1.2.4: **Repost count เพิ่มถูกต้อง** (Bug fix test!)

```bash
# Alice สร้าง post ใหม่
NEW_POST=$(curl -s -X POST http://localhost:3001/posts \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Post for repost test"}')
NEW_ID=$(echo $NEW_POST | jq -r '.id')

# Bob repost
REPOST_RESULT=$(curl -s -X POST "http://localhost:3001/posts/$NEW_ID/repost" \
  -H "Authorization: Bearer $BOB_TOKEN")
echo "Repost result: $REPOST_RESULT"
```

**Expected:**
```json
{ "isReposted": true, "success": true, "repostsCount": 1 }
```

**⚠️ สำคัญมาก:** ก่อน fix — `repostsCount` จะ = `0` เพราะไม่ได้ increment! หลัง fix ต้อง = `1`

---

### ✅ Test 1.2.5: Unrepost count ลดถูกต้อง

```bash
# Bob unrepost
curl -s -X DELETE "http://localhost:3001/posts/$NEW_ID/repost" \
  -H "Authorization: Bearer $BOB_TOKEN"

# Verify count
curl -s "http://localhost:3001/posts/$NEW_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq '.repostsCount'
```

**Expected:** `0`

---

### ✅ Test 1.2.6: **Drift Verification — Manual Injection Test**

```sql
-- ทดสอบ: inject drift โดยตรงใน DB
UPDATE "Post" SET "likesCount" = 999 WHERE id = '$NEW_ID';

-- ดูค่าก่อน
SELECT id, "likesCount" FROM "Post" WHERE id = '$NEW_ID';

-- Alice unlike (จะ trigger drift verification + fix)
curl -s -X POST "http://localhost:3001/posts/$NEW_ID/like" \
  -H "Authorization: Bearer $ALICE_TOKEN"

-- ดูค่าหลัง → ควร fix กลับเป็น 1
SELECT id, "likesCount" FROM "Post" WHERE id = '$NEW_ID';
```

**Expected:** หลัง unlike → `likesCount = 1` (ไม่ใช่ 999)

---

### ✅ Test 1.2.7: Idempotent repost (repost ซ้ำไม่ increment ซ้ำ)

```bash
# Bob repost ซ้ำ
curl -s -X POST "http://localhost:3001/posts/$NEW_ID/repost" \
  -H "Authorization: Bearer $BOB_TOKEN"
curl -s -X POST "http://localhost:3001/posts/$NEW_ID/repost" \
  -H "Authorization: Bearer $BOB_TOKEN"

# Verify count — ต้องเป็น 1 ไม่ใช่ 2
curl -s "http://localhost:3001/posts/$NEW_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq '.repostsCount'
```

**Expected:** `1` (ไม่ใช่ 2)

---

## Task 1.3: Profile totalLikesReceived — SQL SUM Optimization

### ✅ Test 1.3.1: Performance — Profile load กับ user ที่มีโพสต์เยอะ

```bash
# วัด response time
time curl -s "http://localhost:3001/users/alice" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq '.likesCount'
```

**Expected:** Response time ดีขึ้น (sub-second) สำหรับ user ที่มีโพสต์มาก

---

### ✅ Test 1.3.2: likesCount ใน profile ตรงกับ ผลรวมของ posts

```bash
# ดึง profile
PROFILE=$(curl -s "http://localhost:3001/users/alice" \
  -H "Authorization: Bearer $ALICE_TOKEN")
TOTAL=$(echo $PROFILE | jq '.likesCount')

# ดึง posts ของ alice + รวม likesCount ใน SQL
# วิธีที่ 1: ดูจาก feed
curl -s "http://localhost:3001/posts/feed" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq '[.posts[] | select(.user.username == "alice")] | map(.likesCount) | add'

# วิธีที่ 2: ดูจาก DB
# SELECT SUM("likesCount") FROM "Post" WHERE "userId" = '<alice-id>' AND "deletedAt" IS NULL;
```

**Expected:** ทั้งสองวิธีได้ค่าเท่ากัน = `$TOTAL`

---

## Task 2.1: Count Reconciliation Cron

> **หมายเหตุ:** Reconciliation รันอัตโนมัติที่ midnight แต่สามารถ trigger ด้วยวิธีด้านล่าง

### ✅ Test 2.1.1: Manual trigger ผ่าน backend (direct call)

**วิธีที่ 1: สร้าง private endpoint ชั่วคราว**

เพิ่มใน `server/src/maintenance/maintenance.controller.ts` (ถ้าต้องการ):

```typescript
// server/src/maintenance/maintenance.controller.ts
import { Controller, Post, Get } from '@nestjs/common';
import { CountReconciliationService } from './count-reconciliation.service';

@Controller('admin/maintenance')
export class MaintenanceController {
  constructor(private reconcile: CountReconciliationService) {}

  @Post('reconcile')
  async reconcile() {
    return this.reconcile.reconcileAll();
  }

  @Get('reconcile/post/:id')
  async reconcilePost(@Param('id') id: string) {
    return this.reconcile.reconcileSinglePost(id);
  }
}
```

**ทดสอบ:**
```bash
# Trigger reconciliation
curl -X POST http://localhost:3001/admin/maintenance/reconcile \
  -H "Authorization: Bearer $ALICE_TOKEN"
```

**Expected:**
```json
{ "likesFixed": 0, "repostsFixed": 0 }
```

---

### ✅ Test 2.1.2: Inject drift → trigger → verify auto-fix

```bash
# Step 1: หา post ID
POST_ID=$(curl -s "http://localhost:3001/posts/feed" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq -r '.posts[0].id')

# Step 2: Inject drift (ผ่าน DB — ต้องใช้ psql หรือ Prisma Studio)
# psql "postgresql://postgres:postgres@localhost:5432/nexus" -c \
#   "UPDATE \"Post\" SET \"likesCount\" = 888 WHERE id = '$POST_ID';"

# Step 3: Trigger manual reconciliation สำหรับ post นั้น
curl -s "http://localhost:3001/admin/maintenance/reconcile/post/$POST_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN"

# Step 4: เช็ค DB ว่า likesCount กลับมาถูกต้อง
# psql ... -c "SELECT id, \"likesCount\" FROM \"Post\" WHERE id = '$POST_ID';"
```

**Expected:** `likesCount` กลับเป็นค่าที่ถูกต้อง (ไม่ใช่ 888)

---

### ✅ Test 2.1.3: ดู Server logs หลัง midnight

```bash
# รอจนถึง midnight หรือ mock cron
# หรือ trigger ผ่าน Jest test

# ดู logs สำหรับ Reconciliation
# ใน Terminal 1 จะเห็น:
# [Reconciliation] Starting daily count reconciliation...
# [Reconciliation] Done — likes drifts fixed: X, reposts drifts fixed: Y
```

---

## Task 2.2: Video Stale Processing Recovery

### ✅ Test 2.2.1: Video ที่ processing นานเกิน 5 นาที ถูก reset

```bash
# Step 1: Upload video → สร้าง Video record ที่ status = 'processing'
# วิธี: ดึง video ที่กำลัง processing อยู่จาก DB
# psql ... -c "SELECT id, status FROM \"Video\" WHERE status = 'processing';"

# Step 2: Set updatedAt เป็น 10 นาทีก่อน (simulate stale)
# psql ... -c \
#   "UPDATE \"Video\" SET \"updatedAt\" = NOW() - INTERVAL '10 minutes' WHERE id = '<video-id>';"

# Step 3: รอ 10 นาที หรือ mock cron time (แนะนำ: รอจริง 10 นาที หรือแก้ threshold เป็น 1 นาทีใน test)

# Step 4: ดู logs สำหรับ Recovery
# [Recovery] Found N stale processing videos
# [Recovery] Resetting stale video xxxxxxxx to failed
```

**Expected:** Video status = `'failed'`, error = `'Processing timeout — auto-reset by recovery cron'`

---

### ✅ Test 2.2.2: Video ที่ยัง processing ปกติ (น้อยกว่า 5 นาที) ไม่ถูก reset

```bash
# ดู video ที่กำลัง process อยู่
# psql ... -c "SELECT id, status, \"updatedAt\" FROM \"Video\" WHERE status = 'processing';"

# เช็คว่า updatedAt ภายใน 5 นาที → ไม่ถูก reset
# รอ cron ทำงาน (10 นาที) → video นี้ยังคง status = 'processing'
```

**Expected:** Video ปกติ (ไม่ถูก reset)

---

## Task 2.3: Media Integrity Health Check

### ✅ Test 2.3.1: Manual trigger media integrity check

เพิ่ม endpoint ชั่วคราวใน `MaintenanceModule`:

```typescript
// ใน server/src/maintenance/maintenance.module.ts เพิ่ม controller
// หรือสร้างไฟล์ใหม่: maintenance.controller.ts

@Controller('admin/maintenance')
export class MaintenanceController {
  constructor(
    private media: MediaIntegrityService,
    private reconcile: CountReconciliationService,
  ) {}

  @Get('media-check')
  async checkMedia() {
    return this.media.checkMediaIntegrity();
  }
}
```

**ทดสอบ:**
```bash
curl -s http://localhost:3001/admin/maintenance/media-check \
  -H "Authorization: Bearer $ALICE_TOKEN"
```

**Expected:**
```json
{ "checked": 15, "failed": 0 }
```

---

### ✅ Test 2.3.2: ตรวจสอบ failed URL detection

```bash
# Step 1: สร้าง post ที่มี media URL ที่ไม่มีอยู่จริง
# แก้ mediaUrls ใน DB เป็น path ที่ไม่มี
# psql ... -c \
#   "UPDATE \"Post\" SET \"mediaUrls\" = '[\"http://localhost:3001/uploads/nonexistent.jpg\"]' WHERE id = '<post-id>';"

# Step 2: Run health check
curl -s http://localhost:3001/admin/maintenance/media-check \
  -H "Authorization: Bearer $ALICE_TOKEN"

# Step 3: ดู logs
# [MediaIntegrity] FAILED: http://localhost:3001/uploads/nonexistent.jpg (post xxxxxxxx)
# [MediaIntegrity] Done — checked: 15, failed: 1
```

**Expected:** `failed: 1` และ log แสดง URL ที่ fail

---

## 📋 Testing Checklist Summary

```
□ Task 1.1.1: /auth/me มี token field
□ Task 1.1.2: Login ยังคืน token
□ Task 1.1.3: Token จาก /auth/me ใช้งานได้
□ Task 1.2.1: Like count = 1 หลัง like
□ Task 1.2.2: Like count = 0 หลัง unlike
□ Task 1.2.3: Cross-user like count correct
□ Task 1.2.4: Repost count = 1 (BUG FIX)
□ Task 1.2.5: Unrepost count = 0
□ Task 1.2.6: Drift auto-fix on manual injection
□ Task 1.2.7: Idempotent repost
□ Task 1.3.1: Profile load performance
□ Task 1.3.2: likesCount ใน profile = ผลรวมจริง
□ Task 2.1.1: Reconciliation manual trigger
□ Task 2.1.2: Auto-fix drift via reconciliation
□ Task 2.2.1: Stale video auto-reset
□ Task 2.2.2: Normal video not affected
□ Task 2.3.1: Media integrity check runs
□ Task 2.3.2: Failed URL detected and logged
```

---

## ⚠️ ข้อควรระวังระหว่างทดสอบ

1. **อย่า inject drift ใน production DB** — ทำใน test/development environment เท่านั้น
2. **Drift injection test** — หลัง test เสร็จ ควร reset ค่ากลับด้วย `UPDATE "Post" SET "likesCount" = <correct> WHERE id = '...';`
3. **Video stale test** — รอจริง 5-10 นาที หรือแก้ code เป็น threshold สั้นกว่าใน test
4. **Media integrity check** — ทำใน dev ที่มี media files จริง

---

## 🔧 Automated Test Suggestions (สำหรับอนาคต)

```typescript
// server/test/ssot-reconciliation.spec.ts
describe('SSOT Count Reconciliation', () => {
  it('should fix likesCount drift', async () => {
    // 1. Create post
    // 2. Like → likesCount = 1
    // 3. Inject drift: UPDATE likesCount = 999
    // 4. Call reconcileSinglePost()
    // 5. Expect: likesCount = 1
  });

  it('should fix repostsCount drift', async () => {
    // Similar pattern
  });
});
```
