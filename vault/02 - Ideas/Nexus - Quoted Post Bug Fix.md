# Nexus Social — Quoted Post Bug Fix

**Date:** May 6, 2026  
**Issue:** Quoted block ไม่แสดงรูปภาพและเวลาบนหน้า feed (home, hashtag, following) และไม่แสดงเลยใน thread page

---

## อาการ

1. **Thread page (`/posts/[id]`):** เข้า thread ของโพสต์ที่มี quoted post → ไม่เห็น quoted block เลย
2. **หน้า feed (`/home`, `/hashtag/[tag]`, `/following`):** quoted block แสดง text ได้ แต่ไม่แสดงรูปภาพ และไม่มี timestamp

---

## สาเหตุ

### 1. Backend — `getThread()` ไม่ include `quotedPost`

**ไฟล์:** `/workspace/workspace/server/src/posts/posts.service.ts`

```typescript
// ❌ ก่อน — ไม่มี quotedPost
include: {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  _count: { select: { likes: true, replies: true, reposts: true } },
},

// ✅ หลัง — เพิ่ม quotedPost
include: {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  _count: { select: { likes: true, replies: true, reposts: true } },
  quotedPost: { select: { id: true, content: true, mediaUrls: true, createdAt: true, user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } },
},
```

### 2. Frontend — `ThreadPost` interface ไม่มี `quotedPost`

**ไฟล์:** `/workspace/workspace/client/src/app/posts/[id]/page.tsx`

```typescript
// ❌ ก่อน
interface ThreadPost {
  id: string
  content: string
  mediaUrls: string[]
  // ...ไม่มี quotedPost
}

// ✅ หลัง
interface ThreadPost {
  id: string
  content: string
  mediaUrls: string[]
  // ...
  quotedPost?: {
    id: string
    content: string
    mediaUrls?: string[]
    createdAt?: string
    user: { username: string; displayName?: string; avatarUrl?: string | null }
  }
}
```

### 3. Frontend — PostCard ไม่ได้รับ `quotedPost` prop

**ไฟล์:** `/workspace/workspace/client/src/app/posts/[id]/page.tsx`

```tsx
<PostCard
  post={{
    id: post.id,
    user: { ... },
    content: post.content,
    // ...ไม่มี quotedPost
  }}
/>

// ✅ หลัง — เพิ่ม quotedPost
<PostCard
  post={{
    id: post.id,
    // ...
    quotedPost: post.quotedPost,  // ← เพิ่มตรงนี้
  }}
/>
```

### 4. Frontend — `mapPost()` ไม่ map `mediaUrls` และ `createdAt` ของ quotedPost

**ไฟล์:** `/workspace/workspace/client/src/app/home/page.tsx`

```typescript
// ❌ ก่อน
quotedPost: post.quotedPost
  ? {
      id: post.quotedPost.id,
      content: post.quotedPost.content,
      user: post.quotedPost.user,
    }
  : undefined,

// ✅ หลัง — เพิ่ม mediaUrls กับ createdAt
quotedPost: post.quotedPost
  ? {
      id: post.quotedPost.id,
      content: post.quotedPost.content,
      mediaUrls: post.quotedPost.mediaUrls,
      createdAt: post.quotedPost.createdAt,
      user: post.quotedPost.user,
    }
  : undefined,
```

---

## ไฟล์ที่แก้ไข

| ไฟล์ | จุดที่แก้ |
|---|---|
| `server/src/posts/posts.service.ts` | เพิ่ม `quotedPost` ใน Prisma include ของ `getThread()` |
| `client/src/app/posts/[id]/page.tsx` | เพิ่ม `quotedPost` ใน `ThreadPost` interface + pass prop ไป PostCard |
| `client/src/app/home/page.tsx` | เพิ่ม `mediaUrls` + `createdAt` ใน `mapPost()` |
| `client/src/app/hashtag/[tag]/page.tsx` | เพิ่ม `mediaUrls` + `createdAt` ใน `mapPost()` |
| `client/src/app/following/page.tsx` | เพิ่ม `quotedPost` เต็มๆ (ไม่มีเลย) ใน `mapPost()` |

---

## บทเรียน

- ทุกครั้งที่สร้าง API endpoint ใหม่ หรือเพิ่ม relation ใน Prisma → ต้องตรวจสอบว่า include ครบทุก relation ที่ frontend ต้องการ
- `mapPost()` ทุกหน้าต้อง map `quotedPost` เหมือนกันหมด → ควร extract เป็น shared utility
- ถ้า UI ไม่แสดง → ไล่จาก API response → interface → map function → prop passing
