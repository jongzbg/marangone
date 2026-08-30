# Hashtag Service

Hashtag exploration service for discovering posts by hashtag.

## Architecture

```
Client                    NestJS Server                  Database
  │                             │                           │
  │ GET /hashtags/:tag/posts    │                           │
  │ ──────────────────────────► │                           │
  │  ?type=popular|latest|      │                           │
  │      following              │                           │
  │                             │                           │
  │                             │ SELECT posts WHERE        │
  │                             │ content CONTAINS #tag     │
  │                             │ ───────────────────────► │
  │                             │                           │
  │                             │ RETURN posts              │
  │                             │ ◄─────────────────────── │
  │                             │                           │
  │                             │ enrichPosts(userId) ─────┼──► Like table (check isLiked)
  │                             │                           │     Repost table (check isReposted)
  │                             │                           │
  │ ◄───────────────────────────────────────────────────── │
  │   { posts: [...], isLiked, isReposted }               │
```

## How Hashtag Detection Works

Hashtags are **not stored in a separate table**. Instead, posts are searched using `contains` on the `content` field:

```typescript
where: {
  content: { contains: `#${decodedTag}`, mode: 'insensitive' },
  deletedAt: null,
  parentId: null,  // Only original posts, not replies
}
```

**Limitation:** This is a simple string match. A post with `#กินเหล้า` will match, but so will a post with `#กินเหล้าsomething`. For production, consider a proper hashtag table with normalized names.

## Post Data Flow

```
Post.content
   │
   ▼
parseContent() splits on /#[฀-๿\w]+/g
   │
   ▼
#hashtag → <Link href="/hashtag/กินเหล้า">#กินเหล้า</Link>
   │
   ▼
Click → /hashtag/[tag]?type=popular|latest|following
```

## API Endpoint

### GET `/hashtags/:tag/posts`

**Auth:** Required (JWT guard)

**Query Params:**
- `type`: `popular` | `latest` | `following` (default: `latest`)

**Response:**
```typescript
{
  id: string
  content: string
  mediaUrls: string[]
  likesCount: number      // Updated via likesCount field (not _count)
  repostsCount: number
  commentsCount: number
  createdAt: string
  isLiked: boolean         // Current user's like status
  isReposted: boolean     // Current user's repost status
  user: { id, username, displayName, avatarUrl }
  repostedBy?: User       // If current user reposted
}
```

### GET `/hashtags/trending`

**Auth:** None (public)

**Response:**
```typescript
[{ tag: string, postsCount: number }]
```

**Implementation:**
- Scans posts from last 24 hours
- Extracts hashtags via regex `/#([฀-๿\w]+)/g`
- Groups by tag, counts posts, returns top 5

## Tab Sorting Logic

| Tab        | Order By              | Notes                              |
|------------|----------------------|------------------------------------|
| `popular`  | `likesCount DESC`    | Uses denormalized `likesCount` field |
| `latest`   | `createdAt DESC`     | Most recent first                  |
| `following`| `createdAt DESC`     | Only posts from followed users     |

## likesCount Synchronization

The `Post.likesCount` field must be kept in sync with the actual Like table count:

```typescript
// On like
await this.prisma.post.update({
  where: { id: postId },
  data: { likesCount: { increment: 1 } },
})

// On unlike
await this.prisma.post.update({
  where: { id: postId },
  data: { likesCount: { decrement: 1 } },
})
```

**Why?** So `popular` sort uses the pre-sorted `likesCount` instead of expensive GROUP BY on Like table.

## Frontend Route

```
/hashtag/[tag]?type=popular|latest|following
```

**Example:** `/hashtag/กินเหล้า?type=popular`

**Tabs:**
- Active tab highlighted with blue underline
- Tab change updates URL param, refetches data
- Empty state: "ไม่มีโพสต์ที่เกี่ยวกับ #{tag} เลย"

## Real-time Refresh

Trending hashtags in `RightSidebar` auto-refresh when a new post is created:

```
PostComposer.handlePost()
   │
   ▼
postApi.createPost() success
   │
   ▼
window.dispatchEvent(new CustomEvent('nexus:post-created'))
   │
   ▼
RightSidebar useEffect listener
   │
   ▼
hashtagApi.getTrending() → refresh "What's happening"
```

## Related Files

### Backend
- `server/src/hashtags/hashtags.module.ts`
- `server/src/hashtags/hashtags.service.ts`
- `server/src/hashtags/hashtags.controller.ts`

### Frontend
- `client/src/app/hashtag/[tag]/page.tsx`
- `client/src/components/posts/PostCard.tsx` (parseContent for hashtag rendering)
- `client/src/lib/api.ts` (hashtagApi)

### Vault
- `vault/00 - Projects/Nexus/Backend/Posts-Service.md`
- `vault/00 - Projects/Nexus/Frontend/Pages.md`
