# Frontend Pages

## Page Structure

```
client/src/app/
├── page.tsx                    # Redirects to /home
├── login/
│   └── page.tsx               # Login/Register
├── home/
│   └── page.tsx               # For You feed
├── following/
│   └── page.tsx               # Following feed
├── hashtag/
│   └── [tag]/
│       └── page.tsx           # Hashtag exploration (Popular/Latest/Following tabs)
├── posts/
│   └── [id]/
│       └── page.tsx           # Post detail + thread
├── profile/
│   └── [username]/
│       └── page.tsx           # User profile
└── edit-profile/
    └── page.tsx               # Edit own profile (avatar/banner upload)
```

## Page Details

### Home (`/home`)
- Algorithmic "For You" feed
- Post composer at top
- Infinite scroll with cursor pagination
- Actions: like, repost, quote, comment, delete, pin

### Following (`/following`)
- Posts from followed users only
- Same UI as home page
- Shows only last 24 hours

### Hashtag (`/hashtag/:tag`)
- Click any `#hashtag` in post content → navigates here
- 3 tabs: Popular (likes sort), Latest (time sort), Following (followed users only)
- URL: `/hashtag/กินเหล้า?type=popular`
- Real-time: trending hashtags in RightSidebar refresh on new post creation
- Empty state if no posts found

### Post Detail (`/posts/:id`)
- Single post with full content
- Thread replies below
- Inline reply input
- Like/repost on main post and replies

### Profile (`/profile/:username`)
- Banner + avatar + bio
- Click avatar → full-size lightbox (all profiles)
- Stats: followers, following, posts, likes
- Tabs: Posts | Likes
- Follow/Unfollow button (if not own profile)
- Post composer (if own profile)

### Edit Profile (`/edit-profile`)
- Edit display name, bio, location, website
- Click avatar/banner → file picker opens
- Upload → local preview immediately
- Avatar: POST `/upload/avatar` → Sharp processes 3 WebP sizes → saves medium URL
- Banner: POST `/upload/image` → saves raw file URL
- Save button disabled during upload

## Custom Events (Real-time Updates)

Components communicate via `window.dispatchEvent`:

| Event                    | Trigger                          | Listener                |
|--------------------------|----------------------------------|------------------------|
| `nexus:post-created`     | PostComposer success              | RightSidebar           |
| `nexus:like-changed`     | handleLike (toggleLike API call) | LeftSidebar            |

## Components

| Component        | Location                | Purpose                        |
|------------------|-------------------------|--------------------------------|
| `MainLayout`     | `components/layout/`     | 3-column layout wrapper         |
| `Header`         | `components/layout/`     | Top nav + search               |
| `LeftSidebar`    | `components/layout/`     | Leaderboards (Total/Today's likes) |
| `RightSidebar`   | `components/layout/`     | Trending                       |
| `BottomNav`      | `components/layout/`     | Mobile nav                     |
| `FAB`            | `components/layout/`     | Floating action button         |
| `PostCard`       | `components/posts/`      | Single post display            |
| `PostComposer`   | `components/posts/`      | New post form                  |
| `PostActions`    | `components/posts/`      | Like/repost/comment buttons    |
| `CommentModal`   | `components/posts/`      | Comments overlay               |
| `QuoteModal`     | `components/posts/`      | Quote post overlay             |
| `ProfileHeader`  | `components/profile/`    | Profile info + avatar lightbox |

## Key Frontend Bugs Fixed

### Optimistic UI — Stale Closure
`handleLike` and `handleRepost` on profile page used `setState(value)` instead of `setState(prev => ...)`, causing no re-render when API returned same structure. Fixed with functional updates.

### Filter Logic
- Unlike on Tab Likes: filter only **after** server confirms, not optimistically
- Undo repost on Tab Posts: filter post out because it's no longer a repost
- Both tabs must not filter the wrong list

### Avatar Display
- LeftSidebar: validate absolute URL before using `avatarUrl`, fallback to DiceBear
- ProfileHeader: `isOwnProfile` check — own profile gets Edit/Logout dropdown, others get lightbox

## API Client

Location: `client/src/lib/api.ts`

```typescript
// Auth
api.post('/auth/register', data)
api.post('/auth/login', data)
api.get('/auth/me')

// Posts
api.get('/posts/feed')
api.get('/posts/following-feed')
api.get('/posts/user/:username')
api.post('/posts')
api.post('/posts/:id/like')
api.post('/posts/:id/repost')

// Users
api.get('/users/search')
api.get('/users/:username')
api.patch('/users/me')
api.post('/users/:id/follow')
```

## Upload Flow (Edit Profile)

```
User clicks avatar
  ↓
<input type="file"> opens
  ↓
File selected → URL.createObjectURL() shows preview
  ↓
POST /upload/avatar (FormData)
  ↓
Backend: sharp processes → thumb/medium/full.webp
  ↓
Frontend receives { thumb, medium, full }
  ↓
Save medium as avatarUrl in state
  ↓
User clicks Save
  ↓
PATCH /users/me { avatarUrl, ... }
  ↓
Redirect to /profile/:username
```
