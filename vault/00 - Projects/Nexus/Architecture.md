# Nexus Architecture

## System Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Next.js   │────▶│   NestJS    │
│  (Frontend) │     │  (Client)  │     │  (Server)   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ PostgreSQL  │
                                        │  (Prisma)  │
                                        └─────────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 (App Router) | UI, Routing |
| Styling | Tailwind CSS | Styling |
| State | React Hooks | Local state |
| API Client | Axios | HTTP requests |
| Backend | NestJS | REST API |
| ORM | Prisma | Database access |
| Database | PostgreSQL | Data storage |
| Auth | JWT (Passport) | Authentication |

## Project Structure

```
workspace/
├── client/                    # Next.js Frontend
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   │   ├── home/
│   │   │   ├── following/
│   │   │   ├── posts/[id]/
│   │   │   ├── profile/[username]/
│   │   │   └── login/
│   │   ├── components/      # React components
│   │   │   ├── layout/     # Layout components
│   │   │   ├── posts/     # Post-related
│   │   │   └── profile/   # Profile-related
│   │   └── lib/           # Utilities
│   │       ├── api.ts      # API client
│   │       └── format.ts  # Date formatting
│   └── public/
│
└── server/                   # NestJS Backend
    ├── src/
    │   ├── auth/           # Authentication
    │   │   ├── strategies/
    │   │   ├── guards/
    │   │   └── dto/
    │   ├── posts/          # Posts module
    │   │   ├── dto/
    │   │   └── posts.*
    │   ├── users/          # Users module
    │   │   ├── dto/
    │   │   └── users.*
    │   └── prisma/        # Database service
    └── prisma/
        └── schema.prisma  # Database schema
```

## Authentication Flow

```
User Login:
1. POST /auth/login { email, password }
2. Server validates credentials
3. Server returns JWT token
4. Frontend stores token in localStorage
5. Axios interceptor adds token to all requests

Authenticated Requests:
Authorization: Bearer <token>
```

## API Communication

### Axios Interceptor Pattern

```typescript
// api.ts - Automatic token injection
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

### Guard Pattern (NestJS)

```typescript
// JwtAuthGuard - Protects routes
// @UseGuards(JwtAuthGuard) - Applied to controller methods

// Controller gets user from request
@Get('feed')
@UseGuards(JwtAuthGuard)
async getFeed(@Request() req) {
  const userId = req.user.id  // Always defined when guard is used
}
```

## Key Patterns

### Optimistic Updates

```typescript
// Frontend: Update UI immediately, then sync with server
const handleLike = async (postId: string) => {
  // 1. Optimistic update
  setPosts(prev => prev.map(p =>
    p.id === postId
      ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 }
      : p
  ))

  try {
    // 2. Server request
    await postApi.toggleLike(postId)
  } catch {
    // 3. Rollback on error
    setPosts(prev => prev.map(p => /* revert */))
  }
}
```

### Cursor Pagination

```typescript
// Backend: Return next cursor
const posts = await prisma.post.findMany({
  take: take + 1,  // Take one extra to check if there's more
  orderBy: { createdAt: 'desc' },
})

let nextCursor: string | undefined
if (posts.length > take) {
  posts.pop()  // Remove the extra one
  nextCursor = posts[posts.length - 1].createdAt.toISOString()
}

return { posts, nextCursor }

// Frontend: Use cursor for next page
const loadMore = async () => {
  const res = await api.get('/posts/feed', { params: { cursor: nextCursor } })
  setPosts(prev => [...prev, ...res.data.posts])
  setNextCursor(res.data.nextCursor)
}
```

## Component Hierarchy

```
MainLayout
├── Header
├── LeftSidebar
│   ├── LeaderboardCard
│   └── TopLikedCard
├── MainContent (page)
│   ├── PostComposer (optional)
│   └── PostCard[] (list)
│       └── PostActions
│           ├── LikeButton
│           ├── RepostButton
│           ├── CommentButton
│           └── QuoteButton
├── RightSidebar
│   └── TrendsCard
└── BottomNav (mobile)
```

## State Management

| State | Location | Purpose |
|-------|----------|---------|
| Token | localStorage | Persist auth |
| User Profile | React useState | Current user |
| Posts List | React useState | Feed/posts list |
| Active Tab | React useState | posts/likes/reposts |

## Environment Variables

### Server (.env)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/nexus
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

### Client (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```