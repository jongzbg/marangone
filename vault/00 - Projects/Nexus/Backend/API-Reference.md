# API Reference

Base URL: `http://localhost:3001`

## Authentication

### Register
```
POST /auth/register
Body: { email, password, username, name }
Response: { user, accessToken }
```

### Login
```
POST /auth/login
Body: { email, password }
Response: { accessToken }
```

### Get Current User
```
GET /auth/me
Headers: Authorization: Bearer ***
Response: { user }
```

---

## Upload

### Upload Image (Banner & Post Media)
```
POST /upload/image
Headers: Authorization: Bearer ***
Content-Type: multipart/form-data
Body: file (binary image/video, max 10MB)
Response: { url: "http://localhost:3001/uploads/filename.jpg" }
```

### Upload Avatar (Profile Picture)
```
POST /upload/avatar
Headers: Authorization: Bearer ***
Content-Type: multipart/form-data
Body: file (binary image only, max 10MB)
Response: {
  "thumb": "http://localhost:3001/uploads/avatars/xxx-thumb.webp",
  "medium": "http://localhost:3001/uploads/avatars/xxx-medium.webp",
  "full": "http://localhost:3001/uploads/avatars/xxx-full.webp"
}
```
Avatar is processed into 3 WebP sizes: thumb (200×200 crop), medium (800px max), full (1600px max).

---

## Users

### Search Users
```
GET /users/search?q=<query>&limit=10
Headers: Authorization: Bearer ***
Response: User[]
```

### Get User Profile
```
GET /users/:username
Headers: Authorization: Bearer ***
Response: { id, username, displayName, avatarUrl, bio, ... }
```

### Update Profile
```
PATCH /users/me
Headers: Authorization: Bearer ***
Body: { displayName?, bio?, location?, website?, avatarUrl?, bannerUrl? }
Response: Updated user object
```
**Note:** `avatarUrl` and `bannerUrl` accept any string URL (no strict URL validation).

### Follow User
```
POST /users/:id/follow
Headers: Authorization: Bearer ***
Response: { success: true }
```

### Unfollow User
```
DELETE /users/:id/follow
Headers: Authorization: Bearer ***
Response: { success: true }
```

### Get Top Creators (Today's Likes)
```
GET /users/top/creators
Headers: Authorization: Bearer ***
Response: User[] ordered by likes received today
```

### Get Most Likes (All-Time)
```
GET /users/most-likes
Headers: Authorization: Bearer ***
Response: User[] ordered by total likes received
```

---

## Posts

### Get Feed (For You)
```
GET /posts/feed?cursor=<timestamp>&limit=20
Headers: Authorization: Bearer ***
Response: { posts[], nextCursor }
```

### Get Following Feed
```
GET /posts/following-feed?cursor=<timestamp>&limit=20
Headers: Authorization: Bearer ***
Response: { posts[], nextCursor }
```

### Get User Posts
```
GET /posts/user/:username?cursor=<timestamp>&limit=20
Headers: Authorization: Bearer ***
Response: { posts[], nextCursor }
```
Returns original posts + reposts merged, sorted by time.

### Get User Liked Posts
```
GET /posts/user/:username/likes
Headers: Authorization: Bearer ***
Response: { posts[], nextCursor }
```

### Get Single Post
```
GET /posts/:id
Headers: Authorization: Bearer ***
Response: Post object with { isLiked, likesCount, commentsCount, repostsCount }
```

### Create Post
```
POST /posts
Headers: Authorization: Bearer ***
Body: { content, mediaUrls? }
Response: Created post object
```

### Delete Post
```
DELETE /posts/:id
Headers: Authorization: Bearer ***
Response: { success: true }
```

### Like Post (Toggle)
```
POST /posts/:id/like
Headers: Authorization: Bearer ***
Response: { isLiked: boolean, likesCount: number }
```

### Repost
```
POST /posts/:id/repost
Headers: Authorization: Bearer ***
Response: { isReposted: true, repostsCount: number }
```

### Undo Repost
```
DELETE /posts/:id/repost
Headers: Authorization: Bearer ***
Response: { isReposted: false, repostsCount: number }
```

### Quote Post
```
POST /posts/:id/quote
Headers: Authorization: Bearer ***
Body: { content }
Response: Created post object
```

### Get Post Thread (Replies)
```
GET /posts/:id/thread
Headers: Authorization: Bearer ***
Response: { post, replies[] }
```
**Requires `@UseGuards(JwtAuthGuard)`** — returns `isLiked`, `isReposted` for the authenticated user.

### Get Comments
```
GET /posts/:id/comments?cursor=<timestamp>
Headers: Authorization: Bearer ***
Response: { comments[], nextCursor }
```

### Add Comment
```
POST /posts/:id/comment
Headers: Authorization: Bearer ***
Body: { content }
Response: Created comment object
```

### Delete Comment
```
DELETE /posts/comments/:commentId
Headers: Authorization: Bearer ***
Response: { success: true }
```

### Pin Post
```
POST /posts/:id/pin
Headers: Authorization: Bearer ***
Response: { success: true }
```

### Unpin Post
```
DELETE /posts/:id/pin
Headers: Authorization: Bearer ***
Response: { success: true }
```

---

## Hashtags

### Get Posts by Hashtag
```
GET /hashtags/:tag/posts?type=popular|latest|following
Headers: Authorization: Bearer ***
Response: Post[] with { isLiked, isReposted, likesCount, repostsCount, commentsCount }
```
**Tab sorting:**
- `popular` → ordered by `likesCount DESC`
- `latest` → ordered by `createdAt DESC`
- `following` → only posts from followed users, ordered by `createdAt DESC`

### Get Trending Hashtags
```
GET /hashtags/trending
Response: [{ tag: string, postsCount: number }]
```
Returns top 5 hashtags from posts in the last 24 hours.

---

## Response Shapes

### Post Object
```typescript
{
  id: string
  content: string
  mediaUrls: string[]
  createdAt: string
  user: {
    id: string
    username: string
    displayName: string
    avatarUrl: string
  }
  isLiked: boolean
  isReposted: boolean
  likesCount: number
  commentsCount: number
  repostsCount: number
  repostedBy?: { id, username, displayName, avatarUrl }  // if repost
}
```

### User Object
```typescript
{
  id: string
  username: string
  displayName: string
  avatarUrl: string
  bannerUrl: string
  bio: string
  location: string
  website: string
  followersCount: number
  followingCount: number
  postsCount: number
  likesCount: number
  likesTodayCount: number
  isFollowing: boolean
}
```
