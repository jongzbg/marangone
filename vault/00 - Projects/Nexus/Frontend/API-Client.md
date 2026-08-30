# API Client

Axios-based API client for frontend communication with backend.

## Setup

```typescript
// client/src/lib/api.ts
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to all requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})
```

## API Endpoints

### Auth API

```typescript
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (email: string, password: string, username: string, displayName: string) =>
    api.post('/auth/register', { email, password, username, displayName }),

  me: () => api.get('/auth/me'),
}
```

**Usage:**
```typescript
// Login
const res = await authApi.login('test@test.com', 'password')
localStorage.setItem('token', res.data.token)

// Register
const res = await authApi.register('test@test.com', 'password', 'username', 'Display Name')

// Get current user
const res = await authApi.me()
const user = res.data.user
```

---

### User API

```typescript
export const userApi = {
  getProfile: (username: string) => api.get(`/users/${username}`),
  updateProfile: (data: ProfileData) => api.patch('/users/me', data),
  follow: (userId: string) => api.post(`/users/${userId}/follow`),
  unfollow: (userId: string) => api.delete(`/users/${userId}/follow`),
  getTopCreators: () => api.get('/users/top/creators'),
  getMostLiked: () => api.get('/users/most-likes'),
}
```

**Usage:**
```typescript
// Get profile
const res = await userApi.getProfile('johndoe')

// Follow user
await userApi.follow(userId)

// Update profile
await userApi.updateProfile({
  displayName: 'New Name',
  bio: 'Hello world',
  avatarUrl: 'https://example.com/avatar.jpg'
})
```

---

### Post API

```typescript
export const postApi = {
  getFeed: (cursor?: string) => api.get('/posts/feed', { params: { cursor } }),
  getFollowingFeed: (cursor?: string) => api.get('/posts/following-feed', { params: { cursor } }),
  getUserPosts: (username: string, cursor?: string) =>
    api.get(`/posts/user/${username}`, { params: { cursor } }),
  getPost: (postId: string) => api.get(`/posts/${postId}`),
  createPost: (content: string, mediaUrls?: string[]) =>
    api.post('/posts', { content, mediaUrls }),
  deletePost: (postId: string) => api.delete(`/posts/${postId}`),
  toggleLike: (postId: string) => api.post(`/posts/${postId}/like`),
  repost: (postId: string) => api.post(`/posts/${postId}/repost`),
  unrepost: (postId: string) => api.delete(`/posts/${postId}/repost`),
  quotePost: (postId: string, content: string) =>
    api.post(`/posts/${postId}/quote`, { content }),
  pinPost: (postId: string) => api.post(`/posts/${postId}/pin`),
  unpinPost: (postId: string) => api.delete(`/posts/${postId}/pin`),
  getComments: (postId: string, cursor?: string) =>
    api.get(`/posts/${postId}/comments`, { params: { cursor } }),
  createComment: (postId: string, content: string) =>
    api.post(`/posts/${postId}/comment`, { content }),
  deleteComment: (commentId: string) => api.delete(`/posts/comments/${commentId}`),
  getThread: (postId: string) => api.get(`/posts/${postId}/thread`),
  createReply: (postId: string, content: string) =>
    api.post(`/posts/${postId}/reply`, { content }),
  getUserReposts: (username: string, cursor?: string) =>
    api.get(`/posts/user/${username}/reposts`, { params: { cursor } }),
  getUserLikedPosts: (username: string, cursor?: string) =>
    api.get(`/posts/user/${username}/likes`, { params: { cursor } }),
}
```

**Usage:**
```typescript
// Create post with images
const res = await postApi.createPost('Hello world!', ['https://example.com/img.jpg'])

// Toggle like
const res = await postApi.toggleLike(postId)
console.log(res.data.isLiked) // true or false

// Get feed with pagination
const res = await postApi.getFeed()
const { posts, nextCursor } = res.data
if (nextCursor) {
  const more = await postApi.getFeed(nextCursor)
}
```

---

### Upload API

```typescript
export const uploadApi = {
  uploadImage: (file: File) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)
    return axios.post(`${API_BASE_URL}/upload/image`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  uploadAvatar: (file: File) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)
    return axios.post(`${API_BASE_URL}/upload/avatar`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}
```

**Usage — avatar upload:**
```typescript
const handleUpload = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  // Show local preview immediately
  const objectUrl = URL.createObjectURL(file)
  setPreview(objectUrl)

  const res = await uploadApi.uploadAvatar(file)
  // Returns: { thumb, medium, full }
  const avatarUrl = res.data.medium
  await userApi.updateProfile({ avatarUrl })
}
```

**Usage — banner upload:**
```typescript
const res = await uploadApi.uploadImage(file)
// Returns: { url }
const bannerUrl = res.data.url
await userApi.updateProfile({ bannerUrl })
```

---

## Response Types

### Post Response
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
    avatarUrl: string | null
  }
  isLiked: boolean
  isReposted: boolean
  likesCount: number
  commentsCount: number
  repostsCount: number
  repostedBy?: User
}
```

### Feed Response
```typescript
{
  posts: Post[]
  nextCursor: string | undefined
}
```

### User Response
```typescript
{
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  bannerUrl: string | null
  bio: string | null
  location: string | null
  website: string | null
  createdAt: string
  followersCount: number
  followingCount: number
  postsCount: number
  likesCount: number
  likesTodayCount: number
  isFollowing: boolean
}
```

---

## Notifications API

**File:** `client/src/lib/notificationsApi.ts`

```typescript
export const notificationsApi = {
  getNotifications: (cursor?: string, limit = 20) =>
    api.get('/notifications', { params: { cursor, limit } }),

  getUnreadCount: () => api.get('/notifications/unread-count'),

  markAllAsRead: () => api.post('/notifications/read'),

  markAsRead: (id: string) => api.post(`/notifications/${id}/read`),
}
```

### Response Types

```typescript
// getNotifications response
{
  notifications: [
    {
      id: string
      type: 'LIKE' | 'COMMENT' | 'REPOST' | 'QUOTE' | 'FOLLOW'
      actor: { id, username, displayName, avatarUrl }
      post?: { id, content }
      isRead: boolean
      createdAt: string
    }
  ],
  nextCursor: string | null
}

// getUnreadCount response
{ unreadCount: number }

// Note: MESSAGE type is excluded from notifications API
```

### Usage

```typescript
import { notificationsApi } from '@/lib/notificationsApi'

// Get notifications list
const res = await notificationsApi.getNotifications()
const { notifications, nextCursor } = res.data

// Mark single notification as read (decrements badge by 1)
await notificationsApi.markAsRead(notificationId)

// Mark all as read (sets badge to 0)
await notificationsApi.markAllAsRead()
```

---

### useNotifications Hook

**File:** `client/src/hooks/useNotifications.ts`

```typescript
const {
  unreadCount,        // number - count excluding MESSAGE
  markAsRead,         // () => void - mark ALL as read, set count to 0
  decrementUnreadCount, // () => void - decrement by 1
  refreshUnreadCount,   // () => void - fetch from server
} = useNotifications({
  onNewNotification?: (notification) => void
})
```

**Important:** Use `decrementUnreadCount` when clicking a single notification, NOT `markAsRead`. Using `markAsRead` would set the count to 0 immediately instead of decrementing by 1.

---

## Pattern: Optimistic Updates

```typescript
const [posts, setPosts] = useState<Post[]>([])

const handleLike = async (postId: string) => {
  // 1. Find post
  const post = posts.find(p => p.id === postId)
  if (!post) return

  // 2. Optimistic update
  setPosts(prev => prev.map(p =>
    p.id === postId
      ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 }
      : p
  ))

  try {
    // 3. API call
    await postApi.toggleLike(postId)
  } catch {
    // 4. Rollback on error
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 }
        : p
    ))
  }
}
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Related Files

- `client/src/lib/api.ts`