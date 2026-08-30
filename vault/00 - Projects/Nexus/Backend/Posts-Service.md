# Posts Service

Post management service handling CRUD, interactions, feeds, and threads.

## Post Data Structure

```typescript
interface Post {
  id: string
  content: string
  mediaUrls: string[]
  createdAt: Date
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
  repostedBy?: User  // If this is a repost
}
```

## Methods

### createPost

Create a new post.

```typescript
async createPost(
  userId: string,
  username: string,
  content: string,
  mediaUrls?: string[]
): Promise<Post>
```

---

### getPost

Get a single post by ID.

```typescript
async getPost(postId: string, currentUserId?: string): Promise<Post>
```

**Features:**
- Checks if `currentUserId` has liked this post
- Returns `isLiked`, `likesCount`, `commentsCount`, `repostsCount`

**Errors:**
- `NotFoundException` if post deleted or not found

---

### deletePost

Soft delete a post (set `deletedAt` timestamp).

```typescript
async deletePost(postId: string, userId: string): Promise<{ success: true }>
```

**Security:** Only post owner can delete

**Errors:**
- `NotFoundException` if post not found
- `ForbiddenException` if not owner

---

### toggleLike

Toggle like on a post.

```typescript
async toggleLike(userId: string, postId: string): Promise<{
  isLiked: boolean
  liked: boolean
  likesCount: number
}>
```

**Behavior:**
- If not liked → create like, return `isLiked: true`
- If liked → delete like, return `isLiked: false`

---

### repost

Repost another user's post.

```typescript
async repost(userId: string, postId: string): Promise<{
  isReposted: boolean
  success: boolean
  repostsCount: number
}>
```

**Behavior:**
- If not reposted → create repost, return `isReposted: true`
- If already reposted → return current state

---

### unrepost

Remove a repost.

```typescript
async unrepost(userId: string, postId: string): Promise<{
  isReposted: boolean
  success: boolean
  repostsCount: number
}>
```

---

### quotePost

Create a quote post (repost with comment).

```typescript
async quotePost(
  userId: string,
  username: string,
  postId: string,
  content: string
): Promise<Post>
```

**Implementation:** Creates post with `parentId` pointing to quoted post

**Errors:**
- `NotFoundException` if quoted post deleted or not found

---

### pinPost / unpinPost

Pin/unpin post to profile.

```typescript
async pinPost(postId: string, userId: string): Promise<{ success: true; message: string }>
async unpinPost(postId: string, userId: string): Promise<{ success: true; message: string }>
```

**Note:** Currently returns `"Pin not available"` - feature not fully implemented

---

### getFeed

Get algorithmic "For You" feed.

```typescript
async getFeed(userId: string, cursor?: string): Promise<{
  posts: Post[]
  nextCursor: string | undefined
}>
```

**Features:**
- Returns posts from last 24 hours
- Excludes replies (only parent posts)
- Includes `isLiked`, `isReposted`, `repostedBy` for current user
- Cursor pagination (20 posts per page)

---

### getFollowingFeed

Get feed from followed users.

```typescript
async getFollowingFeed(userId: string, cursor?: string): Promise<{
  posts: Post[]
  nextCursor: string | undefined
}>
```

**Features:**
- Only posts from users current user follows
- Last 24 hours
- Same enriched data as `getFeed`

---

### getUserPosts

Get posts for a user profile.

```typescript
async getUserPosts(
  username: string,
  currentUserId?: string,
  cursor?: string
): Promise<{ posts: Post[]; nextCursor: string | undefined }>
```

**Features:**
- Merges original posts + reposts
- Sorts by creation time (original) or repost time
- Includes user's own reposts with `isReposted: true`

---

### getUserLikedPosts

Get posts liked by a user.

```typescript
async getUserLikedPosts(
  username: string,
  currentUserId?: string,
  cursor?: string
): Promise<{ posts: Post[]; nextCursor: string | undefined }>
```

**Features:**
- Only posts liked in last 24 hours
- Returns `isLiked: true` for all posts

---

### getUserReposts

Get posts reposted by a user.

```typescript
async getUserReposts(
  username: string,
  currentUserId?: string,
  cursor?: string
): Promise<{ posts: Post[]; nextCursor: string | undefined }>
```

---

### getComments

Get comments on a post.

```typescript
async getComments(postId: string, cursor?: string): Promise<{
  comments: Comment[]
  nextCursor: string | undefined
}>
```

**Features:**
- Only top-level comments (no nested)
- Sorted oldest first (ascending)

---

### createComment

Add a comment to a post.

```typescript
async createComment(
  userId: string,
  username: string,
  postId: string,
  content: string
): Promise<Post>
```

**Implementation:** Creates post with `parentId` pointing to original post

---

### deleteComment

Delete a comment.

```typescript
async deleteComment(commentId: string, userId: string): Promise<{ success: true }>
```

**Security:** Only comment owner can delete

---

### getThread

Get post with all its replies.

```typescript
async getThread(postId: string, currentUserId?: string): Promise<{
  post: Post
  replies: Reply[]
}>
```

**Features:**
- Returns main post with `isLiked`, `isReposted`
- Returns nested replies (replies to replies)
- Each reply has `repliesCount` (nested reply count)

---

### createReply

Create a reply to a post.

```typescript
async createReply(
  userId: string,
  username: string,
  postId: string,
  content: string
): Promise<Post>
```

**Implementation:** Creates post with `parentId` pointing to original post

---

## Reply/Comment Threading

All replies use `parentId` field:

```
Post (parentId = null)      → Original post
Post (parentId = postId)   → Comment
Post (parentId = replyId)  → Nested reply
```

## Related Files

- `server/src/posts/posts.service.ts`
- `server/src/posts/posts.controller.ts`