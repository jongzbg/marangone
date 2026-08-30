# Feature: Followers/Following List Modal

Clicking Followers/Following stats on a profile opens a modal showing the list of users.

## Overview

- **Motivation:** Users want to see who follows them and who they're following
- **UX Pattern:** Clickable stats → Modal overlay with tabs
- **Related Feature:** Profile stats (followersCount, followingCount)

## Backend

### API Endpoints

```
GET /users/:username/followers  → Follower list
GET /users/:username/following  → Following list
```

Both return:
```typescript
{
  users: Array<{
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    bio: string | null
    isFollowing: boolean
  }>,
  total: number
}
```

### Implementation

**`server/src/users/users.service.ts`**

```typescript
async getFollowers(username: string): Promise<{ users: User[]; total: number }> {
  const user = await this.prisma.user.findUnique({ where: { username } })
  if (!user) throw new NotFoundException('User not found')

  const followers = await this.prisma.follow.findMany({
    where: { followingId: user.id },
    include: {
      follower: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return {
    users: followers.map(f => f.follower),
    total: followers.length
  }
}

async getFollowing(username: string): Promise<{ users: User[]; total: number }> {
  // Same pattern but where: { followerId: user.id }
  // Also includes isFollowing check against current user
}
```

**`server/src/users/users.controller.ts`**

```typescript
@Get(':username/followers')
@Get(':username/following')
// Both use @GetCurrentUser('id') to check isFollowing status
```

### Prisma Model

```prisma
model Follow {
  followerId  String
  followingId String
  createdAt   DateTime @default(now())

  follower   User @relation(...)
  following  User @relation(...)

  @@id([followerId, followingId])
}
```

## Frontend

### API Client

**`client/src/lib/api.ts`**

```typescript
userApi.getFollowers(username: string)
userApi.getFollowing(username: string)
```

### FollowListModal Component

**`client/src/components/profile/FollowListModal.tsx`**

```typescript
interface Props {
  username: string
  initialTab: 'followers' | 'following'
  currentUserId: string
  onClose: () => void
}
```

**Features:**
- Tab switching: "Followers" | "Following"
- User list with avatar, displayName, username, bio snippet
- Follow/Unfollow button inside modal
- **Hide follow button if `user.id === currentUserId`** (can't follow yourself)
- Empty state: "No followers yet" / "Not following anyone yet"
- Loading skeleton while fetching
- API call on tab switch (not pre-fetched)

**UI Structure:**
```
┌─ Modal (overlay with backdrop) ──────┐
│  [Followers] [Following]    [X close] │
│  ─────────────────────────────────── │
│  ┌ Avatar ┐ Name              [Btn] │
│  │         │ @username             │
│  └─────────┴ bio snippet...         │
│  ...more users...                    │
└─────────────────────────────────────┘
```

### ProfileHeader Integration

**`client/src/components/profile/ProfileHeader.tsx`**

Stats are now `<button>` elements (not plain text):

```tsx
<button onClick={() => onFollowersClick()}>
  {followers} Followers
</button>
<button onClick={() => onFollowingClick()}>
  {following} Following
</button>
```

Props added:
```typescript
onFollowersClick: () => void
onFollowingClick: () => void
```

### Profile Page Wiring

**`client/src/app/profile/[username]/page.tsx`**

```tsx
const [showFollowersModal, setShowFollowersModal] = useState(false)
const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers')

const handleFollowersClick = () => {
  setFollowModalTab('followers')
  setShowFollowersModal(true)
}

const handleFollowingClick = () => {
  setFollowModalTab('following')
  setShowFollowersModal(true)
}

<ProfileHeader
  onFollowersClick={handleFollowersClick}
  onFollowingClick={handleFollowingClick}
  // ...other props
/>

{showFollowersModal && (
  <FollowListModal
    username={profile.username}
    initialTab={followModalTab}
    currentUserId={currentUser?.id}
    onClose={() => setShowFollowersModal(false)}
  />
)}
```

## Key Implementation Details

### 1. isFollowing Check
- Backend queries `Follow` table to determine if current user follows each user in list
- Returns `isFollowing: boolean` per user
- Frontend uses this to show Follow or Unfollow button

### 2. Hide Follow Button for Self
```tsx
{user.id !== currentUserId && (
  <FollowButton
    userId={user.id}
    isFollowing={user.isFollowing}
    onUpdate={refetch}
  />
)}
```

### 3. Tab Order
- Left tab: "Followers"
- Right tab: "Following"
- Default to whatever stat was clicked

### 4. Optimistic Follow/Unfollow
- Clicking Follow/Unfollow updates button state immediately
- Reverts on API error

## Related Files

| File | Purpose |
|------|---------|
| `server/src/users/users.service.ts` | `getFollowers()`, `getFollowing()` |
| `server/src/users/users.controller.ts` | GET endpoints |
| `client/src/lib/api.ts` | `userApi.getFollowers()`, `userApi.getFollowing()` |
| `client/src/components/profile/FollowListModal.tsx` | Modal component (new) |
| `client/src/components/profile/ProfileHeader.tsx` | Stats as buttons with callbacks |
| `client/src/app/profile/[username]/page.tsx` | Wires modal to profile |
| `prisma/schema.prisma` | Follow model |

## How to Rebuild

1. **Backend:** Add `getFollowers`/`getFollowing` to service, expose via controller
2. **Frontend API:** Add methods to `userApi` in `api.ts`
3. **Modal:** Create `FollowListModal.tsx` with tabs and user list
4. **ProfileHeader:** Change stat spans to buttons, add click props
5. **Profile Page:** Wire up modal state and callbacks
