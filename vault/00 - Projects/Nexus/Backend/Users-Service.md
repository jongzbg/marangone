# Users Service

User management service handling profiles, follows, and discovery.

## Methods

### getProfile

Get user profile by username.

```typescript
async getProfile(username: string, currentUserId?: string): Promise<UserProfile>
```

**Returns:**
```typescript
{
  id: string
  username: string
  name: string
  displayName: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  bio: string | null
  location: string | null
  website: string | null
  createdAt: Date
  followersCount: number
  followingCount: number
  postsCount: number
  likesCount: number        // Total likes on all posts (all-time)
  likesTodayCount: number   // Likes received today
  isFollowing: boolean     // If currentUserId is following this user
}
```

**Features:**
- Sums all likes on user's posts (including soft-deleted)
- Counts likes received today on active posts only
- Checks follow status if `currentUserId` provided

**Errors:**
- `NotFoundException` if user not found

---

### updateProfile

Update user's own profile.

```typescript
async updateProfile(userId: string, data: UpdateProfileData): Promise<User>
```

**Data:**
```typescript
{
  displayName?: string
  bio?: string
  location?: string
  website?: string
  avatarUrl?: string
  bannerUrl?: string
}
```

**Returns:** Updated user object (without password)

---

### follow

Follow another user.

```typescript
async follow(followerId: string, followingId: string): Promise<{ success: boolean; message: string }>
```

**Features:**
- Prevents self-follow
- Idempotent (returns success if already following)

**Errors:**
- Throws if followerId === followingId

---

### unfollow

Unfollow a user.

```typescript
async unfollow(followerId: string, followingId: string): Promise<{ success: boolean; message: string }>
```

**Features:**
- Uses `deleteMany` (safe even if not following)

---

### getTopCreators

Get users ranked by likes received (last 24 hours).

```typescript
async getTopCreators(limit?: number, currentUserId?: string): Promise<User[]>
```

**Algorithm:**
1. Get users with posts from last 24 hours
2. Sum likes on each user's recent posts
3. Sort by likes descending
4. Return top `limit` users

**Returns:** Users with `likesTodayCount` field

---

### getMostLiked

Get users ranked by total likes received (all-time).

```typescript
async getMostLiked(limit?: number, currentUserId?: string): Promise<User[]>
```

**Algorithm:**
1. Get all users with their posts
2. Sum all likes on non-deleted posts
3. Sort by total likes descending
4. Return top `limit` users

**Returns:** Users with `likesCount` and `likesTodayCount` fields

---

### searchUsers

Search users by username, displayName, or name.

```typescript
async searchUsers(query: string, limit?: number): Promise<User[]>
```

**Features:**
- Case-insensitive search
- Trims whitespace from query
- Returns empty array for empty/short queries

**Returns:** Users with basic info and follower/post counts

---

## Profile Stats Calculation

```
postsCount     = _count.posts (non-deleted only)
followersCount = _count.followers
followingCount = _count.following
likesCount     = Sum of all likes on user's posts (including deleted)
likesTodayCount = Likes received today (active posts only)
```

## Related Files

- `server/src/users/users.service.ts`
- `server/src/users/users.controller.ts`