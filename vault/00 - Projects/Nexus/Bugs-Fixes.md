# Bugs & Fixes

## Bug 1: posts.service.ts Encoding Corruption

**Date:** 2026-04-28
**Severity:** Critical

### Problem
`posts.service.ts` was corrupted — file contained garbage/encoded Chinese characters instead of TypeScript code.

### Root Cause
Unknown encoding issue (possibly save with wrong encoding, or file corruption).

### Solution
Rewrote the entire `PostsService` class based on the controller methods and Prisma schema.

### Files Modified
- `server/src/posts/posts.service.ts`

---

## Bug 2: Thread Page — Like/Repost Icon Colors Wrong

**Date:** 2026-04-30
**Severity:** High

### Problem
In `/posts/:id` thread page, like and repost icons showed wrong colors (always gray/unliked) even when user had already liked/reposted.

### Root Cause
`@Get(':id/thread')` endpoint was **missing `@UseGuards(JwtAuthGuard)`**.

Without the guard:
- Request bypassed authentication
- `req.user` was `undefined`
- Service received `currentUserId = undefined`
- Returned `isLiked: false`, `isReposted: false` always

### Solution
Added `@UseGuards(JwtAuthGuard)` to the endpoint:

```typescript
// BEFORE
@Get(':id/thread')
async getThread(@Param('id') id: string, @Request() req) {
  return this.postsService.getThread(id, req.user?.id);
}

// AFTER
@UseGuards(JwtAuthGuard)
@Get(':id/thread')
async getThread(@Param('id') id: string, @Request() req) {
  return this.postsService.getThread(id, req.user.id);
}
```

### Files Modified
- `server/src/posts/posts.controller.ts`

### Lesson Learned
**Always add `@UseGuards(JwtAuthGuard)` when:**
- Endpoint returns user-specific data
- Response depends on `req.user.id`
- Compare with similar endpoints that work correctly

---

## Bug 3: Undo Repost Still Shows Post in Tab

**Date:** 2026-04-30
**Severity:** Medium

### Problem
When user "undo repost", the post was still visible in the "Posts" tab of their profile.

### Root Cause
After calling `unrepost()` API, the frontend only updated `isReposted` flag but didn't filter out the post from the list.

### Solution
Added filter logic after syncing with server response:

```typescript
setFn((prev) => {
  const synced = prev.map((p) =>
    p.id === postId
      ? { ...p, isReposted: res.data.isReposted, repostsCount: res.data.repostsCount }
      : p
  )
  // Remove from Tab Posts if isReposted is now false
  return activeTab === 'posts'
    ? synced.filter((p) => !(p.id === postId && !p.isReposted))
    : synced
})
```

### Files Modified
- `client/src/app/profile/[username]/page.tsx`

---

## Bug 4: Profile Likes Tab — Unlike One Post Removes All

**Date:** 2026-04-30
**Severity:** High

### Problem
On Profile page → Likes tab: clicking unlike on a single post removed the entire list and showed "ยังไม่ได้ like โพสต์ใดเลย".

Also: on Posts tab, clicking unlike on a reposted post made the post disappear.

### Root Cause
1. `handleLike` had `.filter()` that removed posts from **both tabs** on any unlike
2. `setLikes([])` was called before API response → list cleared before server could confirm

### Solution
1. Only filter on Tab Likes (not Posts tab)
2. Filter only **after** server confirms the unlike, not optimistically
3. Remove `setLikes([])` — let sync handle it

```typescript
// BEFORE: filter immediately
setLikes((prev) => update(prev).filter(...))
setLikes([])

// AFTER: filter only after server confirms
if (activeTab === 'posts') {
  setPosts((prev) => update(prev))
} else {
  setLikes((prev) => update(prev))  // just update, no filter
}
// After API response:
if (activeTab === 'posts') {
  setPosts((prev) => sync(prev))
} else {
  setLikes((prev) => sync(prev).filter((p) => !(p.id === postId && !res.data.isLiked)))
}
```

### Files Modified
- `client/src/app/profile/[username]/page.tsx`

---

## Bug 5: Profile Repost — Stale Closure, No Re-render

**Date:** 2026-04-30
**Severity:** Medium

### Problem
Clicking undo repost → icon color and count don't update in real-time. Must refresh page.

### Root Cause
`handleRepost` used `setPosts(sync(posts))` — `posts` captured from closure was the **old value** before optimistic update, so React saw no state change → no re-render.

Same bug affected `handleLike`.

### Solution
Use functional update (`setFn((prev) => ...)`) so the callback always reads the **latest state**:

```typescript
// BEFORE (stale closure)
setPosts(update(posts))
setPosts(sync(posts))  // uses old posts value!

// AFTER (functional update)
setFn(update)  // optimistic
setFn((prev) => sync(prev))  // uses latest prev
```

### Files Modified
- `client/src/app/profile/[username]/page.tsx`

---

## Bug 6: Profile Avatar Click Opens Dropdown Instead of Lightbox

**Date:** 2026-04-30
**Severity:** Low

### Problem
Clicking avatar on any profile page opened an Edit/Logout dropdown. Should only open on own profile; others should show full-size image.

### Root Cause
Avatar was always wrapped in a `<button>` that toggled a dropdown. No `isOwnProfile` check.

### Solution
Conditionally render:
- Own profile → button + dropdown (Edit Profile / Logout)
- Others → plain `<img>` with lightbox modal on click

```tsx
{isOwnProfile ? (
  <button onClick={() => setDropdownOpen(true)}>...</button>
) : (
  <button onClick={() => setAvatarModalOpen(true)}>...</button>
)}
```

Added `avatarModalOpen` state with full-screen modal overlay.

### Files Modified
- `client/src/components/profile/ProfileHeader.tsx`

---

## Bug 7: LeftSidebar Avatar 404 Errors

**Date:** 2026-04-30
**Severity:** Medium

### Problem
Leaderboard cards in LeftSidebar showed broken images (404 errors) for users who had relative or invalid `avatarUrl`.

### Root Cause
`avatarSrc(url, username)` used `url || fallback` — if URL was relative (`/uploads/...`) or invalid, browser tried to load it from wrong origin.

### Solution
Validate that `avatarUrl` is an absolute URL before using it:

```typescript
const avatarSrc = (url: string | null | undefined, username: string) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url
  }
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`
}
```

### Files Modified
- `client/src/components/layout/LeftSidebar.tsx`

---

## Bug 8: Save Profile Fails After Avatar Upload

**Date:** 2026-04-30
**Severity:** High

### Problem
Uploading avatar works, but clicking "Save" on edit-profile page shows "Failed to save profile. Please try again."

### Root Cause
`UpdateProfileDto` had `@IsUrl()` validator on `avatarUrl` and `bannerUrl`. ValidationPipe rejected `localhost` URLs before reaching the service.

### Solution
Changed `@IsUrl()` → `@IsString()` on both fields:

```typescript
@IsOptional()
@IsString()  // was @IsUrl()
avatarUrl?: string;

@IsOptional()
@IsString()  // was @IsUrl()
bannerUrl?: string;
```

### Files Modified
- `server/src/users/dto/users.dto.ts`

---

## Bug 9: Sharp Import Fails — `(0, sharp_1.default) is not a function`

**Date:** 2026-04-30
**Severity:** Critical

### Problem
`POST /upload/avatar` crashes with error `(0, sharp_1.default) is not a function`.

### Root Cause
`import sharp from 'sharp'` uses ESM-style default export, but NestJS project uses CommonJS — incompatible.

### Solution
Use CommonJS require syntax:

```typescript
// WRONG (ESM import)
import sharp from 'sharp'

// CORRECT (CommonJS require)
const sharp = require('sharp')
```

Also required `sharp.clone()` before each resize operation.

### Files Modified
- `server/src/upload/upload.service.ts`
- Install: `npm install sharp`

---

## Bug 10: .env.windows Committed with Secrets

**Date:** 2026-04-28
**Severity:** Critical (Security)

### Problem
`workspace/server/.env.windows` containing `JWT_SECRET` and `DATABASE_URL` was committed to GitHub.

### Solution
1. Removed file from git history
2. Added `*.windows` to `.gitignore`
3. Created commit to remove from remote

### Prevention
Always check `.gitignore` before committing. Sensitive files should never be tracked.

---

## Bug 11: Notification Bell Showing MESSAGE Notifications

**Date:** 2026-05-01
**Severity:** Medium

### Problem
Notification bell (🔔) showed MESSAGE notifications even though we have a separate message icon (✉️) for message notifications.

### Root Cause
`getNotifications` and `getUnreadCount` didn't filter out `MESSAGE` type notifications.

### Solution
Added `type: { not: 'MESSAGE' }` filter to all notification queries:

```typescript
// getNotifications
where: { userId, type: { not: 'MESSAGE' }, ... }

// getUnreadCount
where: { userId, isRead: false, type: { not: 'MESSAGE' } }

// markAsRead (mark all)
where: { userId, isRead: false, type: { not: 'MESSAGE' } }
```

### Files Modified
- `server/src/notifications/notifications.service.ts`

---

## Bug 12: Clicking One Notification Clears All Badge Count

**Date:** 2026-05-01
**Severity:** Medium

### Problem
Clicking a single notification in the dropdown set the badge count to 0 instantly (should only decrement by 1).

### Root Cause
`handleNotificationClick` called `onMarkAsRead()` which set count to 0. But `onMarkAsRead` was the same callback used for "Mark all as read" button.

### Solution
Split the callback into two:
- `onMarkAllAsRead()` → sets count to 0
- `onMarkOneAsRead()` → decrements count by 1

```typescript
// NotificationDropdown
interface NotificationDropdownProps {
  onClose: () => void
  onMarkAllAsRead: () => void   // set to 0
  onMarkOneAsRead: () => void    // decrement by 1
}

// Header usage
<NotificationDropdown
  onMarkAllAsRead={markAsRead}           // sets to 0
  onMarkOneAsRead={decrementUnreadCount} // -1
/>
```

### Files Modified
- `client/src/hooks/useNotifications.ts` (added `decrementUnreadCount`)
- `client/src/components/NotificationDropdown.tsx`
- `client/src/components/layout/Header.tsx`

---

## Bug 13: Profile likesCount & likesTodayCount Not Updating

**Date:** 2026-05-01
**Severity:** Medium

### Problem
When liking/unliking a post on profile page, the profile header stats (`Likes`, `Likes today`) didn't update until page refresh.

### Root Cause
1. `likesCount` only decremented on unlike, never incremented on like
2. `likesTodayCount` was never updated at all

### Solution
Updated profile sync logic after like action:

```typescript
setProfile((prev) => {
  if (!prev) return prev
  const postInPosts = posts.find((p) => p.id === postId)
  const isOwnPost = postInPosts?.user.id === prev.id
  if (!isOwnPost) return prev

  // Check if post was created today for likesTodayCount
  const isToday = postInPosts && new Date(postInPosts.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)

  if (res.data.isLiked) {
    return {
      ...prev,
      likesCount: prev.likesCount + 1,
      likesTodayCount: isToday ? prev.likesTodayCount + 1 : prev.likesTodayCount,
    }
  } else {
    return {
      ...prev,
      likesCount: Math.max(0, prev.likesCount - 1),
      likesTodayCount: isToday ? Math.max(0, prev.likesTodayCount - 1) : prev.likesTodayCount,
    }
  }
})
```

### Files Modified
- `client/src/app/profile/[username]/page.tsx`

---

## Bug 14: Repost of Deleted Post Still Showing

**Date:** 2026-05-01
**Severity:** Medium

### Problem
Reposts of soft-deleted posts still appeared in user's Posts tab.

### Root Cause
`getUserPosts` fetched reposts without checking if the original post was soft-deleted (`deletedAt` not null).

### Solution
Added filter for deleted original posts:

```typescript
// Reposts query
this.prisma.repost.findMany({
  where: {
    userId: user.id,
    createdAt: { gte: yesterday },
    post: { deletedAt: null, createdAt: { gte: yesterday } }  // filter deleted + old posts
  },
  // ...
})
```

---

## Bug 15: FAB Chat Widget — Multiple Issues

**Date:** 2026-05-05
**Severity:** Medium
**Component:** FAB Chat Widget + MessageBubble

---

### Bug 15a: FAB Panel — "2 Topics" When Opening

**Problem:**
When FAB was clicked to open the chat panel, both the FAB button and the panel were visible simultaneously — appearing as "2 topics."

**Root Cause:**
`FABWidget.tsx` positioned the panel at `bottom-24` while the FAB button remained at `bottom-6`. Both were visible at the same time.

**Solution:**
- FAB button only shows when `panelState === 'closed'`
- Panel positioned at `bottom-6` (same position as FAB button)
- When panel opens, FAB button disappears; panel takes its place

```tsx
{panelState === 'closed' && <FAB button />}
{panelState !== 'closed' && <Panel />}
```

**Files Modified:**
- `client/src/components/chat/FABWidget.tsx`

---

### Bug 15b: FAB Panel — Header Disappeared in Empty State

**Problem:**
FAB panel showed "Chat + X" header only when there were conversations. When empty, the header (including the close button) disappeared — user couldn't close the panel.

**Root Cause:**
Header was inside the "has-conversations" return block, not in the outer wrapper.

**Solution:**
Restructured `FABConversationList.tsx` — header is always rendered outside the conditional content:

```
<div>                          ← always rendered
  <Header>Chat [X]</Header>    ← always shown
  {loading ? spinner : conversations.length === 0 ? empty : list}
</div>
```

**Files Modified:**
- `client/src/components/chat/FABConversationList.tsx`

---

### Bug 15c: FAB Panel — "Close" Button in Empty State

**Problem:**
Empty state in FAB panel had a "Close" button below "No conversations yet" text — confusing UX.

**Solution:**
Removed the Close button from empty state. Header "Chat + X" is always visible and serves as the close mechanism.

**Files Modified:**
- `client/src/components/chat/FABConversationList.tsx`

---

### Bug 15d: FAB Panel — "Support Chat" Should Be "Chat"

**Problem:**
Header text said "Support Chat" instead of "Chat."

**Solution:**
Changed all header text from "Support Chat" → "Chat."

**Files Modified:**
- `client/src/components/chat/FABWidget.tsx`
- `client/src/components/chat/FABConversationList.tsx`

---

### Bug 15e: Message Bubble — Background Too Wide (break-words)

**Problem:**
Single-character messages like `"1"` were stretched to fill the entire bubble width.

**Root Cause:**
CSS `break-words` forces words to break and fill the entire line width.

**Solution:**
Replace `break-words` with `overflow-wrap: break-word`:

```tsx
// WRONG
className="... break-words"

// CORRECT
style={{ overflowWrap: 'break-word' }}
```

`overflow-wrap: break-word` only breaks when necessary — short text stays compact.

**Files Modified:**
- `client/src/components/chat/MessageBubble.tsx`

---

### Bug 15f: Message Bubble — Trailing Space in Content

**Problem:**
First message showed trailing spaces like `"1     "` instead of `"1"`.

**Root Cause:**
Three contributing factors:
1. `FABChatView.tsx` — optimistic message created without `.trim()` on content
2. Backend `chat.service.ts` — stored content as-is without trimming
3. `FABChatView.tsx` — `onMessage` handler didn't replace optimistic message with confirmed server message

**Solution:**
1. `FABChatView.tsx` — `content: content.trim()` when creating optimistic message
2. `chat.service.ts` — `content: dto.content?.trim() ?? ''` when storing to DB
3. `FABChatView.tsx` — `onMessage` handler now replaces optimistic with confirmed (match by `clientId`)

**Files Modified:**
- `client/src/components/chat/FABChatView.tsx`
- `client/src/components/chat/MessageBubble.tsx`
- `server/src/chat/chat.service.ts`

---

### Bug 15g: Message Bubble — Time Stretching Bubble Width

**Problem:**
When time was displayed below the bubble, the bubble's background stretched beyond the text content — even though the bubble itself had correct width.

**Root Cause:**
Time div was inside the `flex flex-col` bubble column. Even with `opacity: 0`, the element still occupied layout space, forcing the parent container to expand.

**Solution:**
Move time div OUTSIDE the bubble column — make it a sibling at the same level.

```tsx
<div className="flex gap-2 group">       {/* Root */}
  <Avatar />
  <BubbleColumn>                      {/* width: fit-content — ONLY bubble */}
    <Bubble>text</Bubble>
  </BubbleColumn>
  <TimeDiv                           {/* SIBLING — opacity-0 → group-hover:opacity-100 */}
    02:49 PM
  </TimeDiv>
</div>
```

Also: Remove time from `MessageBubble` for first message of each day (DateSeparator shows time instead).

**Files Modified:**
- `client/src/components/chat/MessageBubble.tsx`
- `client/src/components/chat/MessageList.tsx`

---

### Bug 15h: Message Bubble — Time Layout

**Problem:**
Time div placed to the side of bubble instead of below.

**Solution:**
Time is now a sibling of the bubble column (not inside it). It appears below the bubble visually because it's aligned to the bottom with `flex flex-col justify-end`. Time only shows on hover via `opacity-0 group-hover:opacity-100`.

**UX Summary:**
- First message of the day → time shown in DateSeparator (e.g., "Today, 02:49 PM")
- Subsequent messages → hover on bubble → time appears below bubble
- Time never stretches bubble width (it's outside the bubble column)

**Files Modified:**
- `client/src/components/chat/MessageBubble.tsx`
- `client/src/components/chat/MessageList.tsx`

---

### Bug 15i: Message Input — `mail` Icon Inconsistent with FAB

**Problem:**
Navbar message icon used `mail` icon, but FAB chat widget used `chat` icon — inconsistent.

**Solution:**
Changed Header message icon from `mail` to `chat` to match FAB.

**Files Modified:**
- `client/src/components/layout/Header.tsx`

---

### Bug 15j: MessageDropdown — "ยังไม่มีข้อความ" Should Be "No conversations yet"

**Problem:**
Empty state in MessageDropdown used Thai text with `chat_off` icon instead of matching FAB style.

**Solution:**
Changed to match FAB empty state:
- Icon: `chat_off` → `chat`
- Text: `ยังไม่มีข้อความ` → `No conversations yet`

**Files Modified:**
- `client/src/components/chat/MessageDropdown.tsx`

---

## Bug 16: LeftSidebar Avatar 404 — Wrong URL Replacement

**Date:** 2026-05-01
**Severity:** Medium

### Problem
LeftSidebar shows broken images (404) for users in "Total likes" and "Today's likes" cards, even though their profile page shows the correct avatar.

### Root Cause
`avatarSrc()` function incorrectly replaced backend URL (`http://localhost:3001`) with frontend URL (`http://localhost:3000`):

```typescript
// WRONG - Frontend (:3000) doesn't serve files!
if (url.startsWith(backendHost)) {
  return url.replace(backendHost, window.location.origin);  // → http://localhost:3000/uploads/...
}
```

### Solution
Keep backend URLs as-is. For relative URLs, prepend `API_BASE_URL`:

```typescript
// CORRECT - Keep backend URLs, prepend API_BASE_URL for relative paths
if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
  return url;  // Keep backend URLs as-is
}
if (url && url.startsWith('/')) {
  return `${API_BASE_URL}${url}`;  // → http://localhost:3001/uploads/...
}
```

### Files Modified
- `client/src/components/layout/LeftSidebar.tsx`

### Key Insight
**Frontend (Next.js :3000) does NOT serve static files** - only the **Backend (NestJS :3001)** serves `/uploads/*`. Always prepend `API_BASE_URL` for relative paths, don't replace the backend origin.

---

## Bug 17: PostCard — Click on Image Goes to Profile Instead of Thread

**Date:** 2026-05-04
**Severity:** High

### Problem
Clicking on an image in a post went to the author's profile instead of the thread.

### Root Cause
1. `<Link>` wrapper on avatar was matching click events from image area
2. Image container didn't have `stopPropagation()` to prevent bubble-up

### Solution
1. Added `stopPropagation()` to avatar and header links
2. Wrapped images with Link to `/posts/:id`
3. Added `w-10 h-10 shrink-0` to avatar Link to prevent it from stretching

```tsx
// Avatar Link - stop bubble + size constraint
<Link
  href={`/profile/${post.user.username}`}
  className="shrink-0 w-10 h-10"
  onClick={(e) => e.stopPropagation()}
>
  <img ... />
</Link>

// Image Link - go to thread
<Link href={`/posts/${post.id}`} onClick={(e) => e.stopPropagation()}>
  <img ... />
</Link>
```

### Files Modified
- `client/src/components/posts/PostCard.tsx`

---

## Bug 18: parseContent — Missing @mention & External URL Detection

**Date:** 2026-05-04
**Severity:** Medium

### Problem
@mentions were not clickable links to profile, and external URLs were not opening in browser.

### Root Cause
`parseContent()` only detected `#hashtags`, not `@mentions` or URLs.

### Solution
Updated regex pattern to match all three:

```tsx
function parseContent(content: string): React.ReactNode[] {
  const parts = content.split(/(@[\wก-๙]+)|(#[฀-๿\w]+)|(https?:\/\/[^\s]+)/g)
  return parts.map((part, i) => {
    if (!part) return part

    // @mention
    if (part.startsWith('@')) {
      const username = part.slice(1)
      return (
        <Link href={`/profile/${username}`} onClick={(e) => e.stopPropagation()}>
          {part}
        </Link>
      )
    }

    // #hashtag
    if (part.startsWith('#')) {
      const tag = part.slice(1)
      return (
        <Link href={`/hashtag/${tag}`} onClick={(e) => e.stopPropagation()}>
          {part}
        </Link>
      )
    }

    // External URL
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      )
    }

    return part
  })
}
```

### Files Modified
- `client/src/components/posts/PostCard.tsx`

---

## Bug 19: Single Image — Lightbox Navigation Arrows Showing

**Date:** 2026-05-04
**Severity:** Low

### Problem
Single image posts showed left/right navigation arrows in lightbox, which are unnecessary for 1 image.

### Root Cause
Lightbox default behavior shows navigation arrows regardless of slide count.

### Solution
Use `render.buttonPrev` and `render.buttonNext` props to conditionally hide arrows:

```tsx
<Lightbox
  open
  close={closeLightbox}
  slides={mediaImages.map((src) => ({ src }))}
  index={lightboxIndex}
  render={{
    buttonPrev: mediaImages.length > 1 ? undefined : () => null,
    buttonNext: mediaImages.length > 1 ? undefined : () => null,
  }}
/>
```

### Files Modified
- `client/src/components/posts/PostCard.tsx`

---

## Bug 20: Thread Page — Icons Layout Different from Home

**Date:** 2026-05-04
**Severity:** Medium

### Problem
Icons (comment, repost, like) on Thread page looked different from Home/Profile pages.

### Root Cause
Thread page used inline button rendering instead of `<PostCard>` component.

### Solution
Replaced inline article rendering with `<PostCard>` component:

```tsx
// BEFORE - inline rendering with different CSS
<article className="p-4 border-b border-border">
  <div className="flex items-center gap-2 ...">
    <button>chat_bubble</button>
    <button>repeat</button>
    <button>favorite</button>
  </div>
</article>

// AFTER - use shared PostCard component
<PostCard
  post={mapPost(post)}
  rawPost={thread.post}
  onLike={handleLike}
  onRepost={handleRepost}
  onQuote={handleQuote}
  onComment={setCommentPost}
  currentUsername={currentUsername || undefined}
  onClick={(e) => e.preventDefault()}
/>
```

### Files Modified
- `client/src/app/posts/[id]/page.tsx`
- Removed inline action buttons → now uses PostCard → PostActions

---

## Bug 21: Thread Page — Avatar Wrong in CommentModal

**Date:** 2026-05-04
**Severity:** Medium

### Problem
When clicking comment icon on Thread page, the CommentModal showed wrong avatar for the current user.

### Root Cause
`currentUser` object in Thread page didn't include `avatarUrl` from `authApi.me()`.

### Solution
Added `currentUserAvatar` state and pass it to CommentModal:

```tsx
// State
const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)

// Fetch
authApi.me().then((res) => {
  setCurrentUsername(res.data.username)
  setCurrentUserAvatar(res.data.avatarUrl || null)
})

// Pass to CommentModal
<CommentModal
  currentUser={{
    id: currentUserId,
    username: currentUsername || '',
    displayName: currentUsername || '',
    avatarUrl: currentUserAvatar,  // Use real avatar
  }}
/>
```

### Files Modified
- `client/src/app/posts/[id]/page.tsx`

---

## Bug 22: Thread Page — Reply Input Avatar Wrong

**Date:** 2026-05-04
**Severity:** Low

### Problem
Reply input at bottom of Thread page ("Reply to @username...") showed wrong avatar.

### Root Cause
Used hardcoded dicebear fallback instead of user's actual avatar URL.

### Solution
Use `currentUserAvatar` with dicebear fallback:

```tsx
// BEFORE
<img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${currentUsername}`} ... />

// AFTER
<img src={currentUserAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUsername}`} ... />
```

### Files Modified
- `client/src/app/posts/[id]/page.tsx`

---

## Bug 23: PostActions — Icons Too Close to Edge

**Date:** 2026-05-04
**Severity:** Low

### Problem
Icons in PostActions were too close to the left/right edges on Thread page.

### Root Cause
PostActions container had no horizontal padding.

### Solution
Added `px-4` to PostActions container:

```tsx
<div className="flex items-center justify-between mt-3 px-4 text-text-muted relative">
  ...
</div>
```

### Files Modified
- `client/src/components/posts/PostActions.tsx`

---

## Bug 24: Like/Repost Creates Duplicate Notifications

**Date:** 2026-05-04
**Severity:** High

### Problem
Rapidly clicking like/unlike on the same post created multiple notification entries for the same action.

### Root Cause
Backend didn't check for existing notification before creating, and didn't delete notification when unliking.

### Solution
1. Check for existing notification before creating
2. Delete notification when unliking/unreposting

```typescript
// toggleLike - unlike
if (existing) {
  await this.prisma.like.deleteMany({ where: { userId, postId } });
  // DELETE notification on unlike
  await this.prisma.notification.deleteMany({
    where: { type: 'LIKE', actorId: userId, postId },
  });
  return ...
}

// toggleLike - like
// Check existing before creating
const existingNotif = await this.prisma.notification.findFirst({
  where: { type: 'LIKE', actorId: userId, postId },
});
if (!existingNotif) {
  await this.prisma.notification.create({
    data: { type: 'LIKE', userId: post.userId, actorId: userId, postId },
  });
}

// repost - same pattern
const existingNotif = await this.prisma.notification.findFirst({
  where: { type: 'REPOST', actorId: userId, postId },
});
if (!existingNotif) {
  await this.prisma.notification.create({ ... });
}

// unrepost - delete notification
await this.prisma.notification.deleteMany({
  where: { type: 'REPOST', actorId: userId, postId },
});
```

### Files Modified
- `server/src/posts/posts.service.ts`

---

## Bug 25: FAB Chat — Unread Count Not Synced with Header Mail Icon

**Date:** 2026-05-05
**Severity:** High

### Problem
When clicking "mark as read" in MessageDropdown (header mail icon), the unread count in the header decreased correctly, but the FAB chat widget still showed the old unread count (did not decrease).

### Root Cause
**Two separate state sources** for the same unread count:

| Component | State | Update Mechanism |
|-----------|-------|-----------------|
| Header (`messageUnreadCount`) | Local state in Header.tsx | Refetches `GET /conversations` on `messages_read` event |
| FAB (`totalUnreadCount`) | State in FABChatContext | Fetches once on mount; decrements only if `activeConversationId` matches |

The FAB's `messages_read` handler only decremented the count if the conversation was **currently open in FAB**.

### Solution
**Refetch unread counts from API** instead of trying to decrement locally:

```typescript
// FABChatContext.tsx - FIXED
useEffect(() => {
  function onMessagesRead() {
    // Refetch conversations to get accurate unread counts
    chatApi.getConversations().then(({ data }) => {
      const conversations = (data as { conversations: Conversation[] })?.conversations || []
      const total = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
      setTotalUnreadCount(total)
    }).catch(() => {})
  }

  window.addEventListener('messages_read', onMessagesRead)
  return () => window.removeEventListener('messages_read', onMessagesRead)
}, [])
```

### Files Modified
- `client/src/contexts/FABChatContext.tsx`

### Key Insight
**Never try to sync state by incrementing/decrementing** — always refetch from the source of truth. Local decrements are fragile because they can drift from the actual count due to:
- Multiple read events
- Read events from different sources (different tabs, FAB, header, messages page)
- WebSocket reconnection

---

## Common Patterns for Bug Fixes

### Pattern 1: Guard Pattern
```typescript
// ALWAYS use guard when accessing req.user
@UseGuards(JwtAuthGuard)
@Get(':id')
async getSomething(@Request() req) {
  // req.user is guaranteed to exist
}
```

### Pattern 2: Functional Update + Optimistic UI
```typescript
// 1. Optimistic update
setFn(update)
// 2. Call API
const res = await api.toggleLike(postId)
// 3. Functional sync — avoids stale closure
setFn((prev) => sync(prev))
```

### Pattern 3: Filter After Confirm
```typescript
// Filter from list only AFTER server confirms the action
if (activeTab === 'posts') {
  // Don't filter — just sync
  setPosts((prev) => sync(prev))
} else {
  // Filter only after server confirms
  setLikes((prev) => sync(prev).filter((p) => !(p.id === postId && !res.data.isLiked)))
}
```

### Pattern 4: Sharp Usage
```typescript
const sharp = require('sharp')  // NOT import
await image.clone().resize(...).webp(...).toFile(path)
```

### Pattern 5: DTO Validation
```typescript
// For URL fields that might be localhost/relative
@IsOptional()
@IsString()  // Don't use @IsUrl() for user-provided URLs
avatarUrl?: string
```

### Pattern 6: Avatar Link Size Constraint
```tsx
// Always add w/h to Link wrapper to prevent stretching
<Link href="..." className="shrink-0 w-10 h-10">
  <img ... />
</Link>
```

### Pattern 7: Stop Propagation
```tsx
// Links inside clickable containers need stopPropagation
<article onClick={handleClick}>
  <Link onClick={(e) => e.stopPropagation()} href="...">
    ...
  </Link>
</article>
```

### Pattern 8: Notification Deduplication
```typescript
// Before creating notification
const existing = await prisma.notification.findFirst({
  where: { type, actorId, postId },
});
if (!existing) {
  await prisma.notification.create({ data: { type, actorId, postId, userId } });
}

// Before deleting, also delete notification
await prisma.notification.deleteMany({
  where: { type, actorId, postId },
});
```

### Pattern 9: Fragment Wrapper for JSX Siblings
```tsx
// If return has multiple root elements, wrap in fragment
return (
  <>
    <article>...</article>
    <Lightbox ... />
  </>
)
```

### Pattern 10: Time Outside Bubble Column
```tsx
// WRONG — time inside flex-col stretches parent
<div className="flex flex-col">
  <Bubble />
  <Time opacity-0 />   {/* occupies space even when hidden */}
</div>

// CORRECT — time as sibling, bubble column stays compact
<div className="flex gap-2 group">
  <BubbleColumn style={{ width: 'fit-content' }}>
    <Bubble />
  </BubbleColumn>
  <Time opacity-0 group-hover:opacity-100 />  {/* sibling */}
</div>
```

### Pattern 11: CSS overflow-wrap
```tsx
// WRONG — break-words stretches single chars to fill line
className="... break-words"

// CORRECT — break-word only breaks when necessary
style={{ overflowWrap: 'break-word' }}
```

### Pattern 12: Header Always Visible
```tsx
// WRONG — header inside conditional
{loading ? <Spinner /> : conversations.length > 0 ? (
  <div>
    <Header />   {/* only shown when has conversations */}
    <List />
  </div>
) : <Empty />

// CORRECT — header always rendered
<div>
  <Header />   {/* always shown */}
  {loading ? <Spinner /> : conversations.length === 0 ? <Empty /> : <List />}
</div>
```

### Pattern 13: Optimistic Message + Replacement
```tsx
// 1. Send with trim
content: content.trim()

// 2. Store in DB with trim
content: dto.content?.trim() ?? ''

// 3. Handler replaces optimistic with confirmed (match by clientId)
if ('clientId' in message && message.clientId) {
  const hasMatch = prev._localMessages.some(
    (m) => 'clientId' in m && m.clientId === message.clientId
  )
  if (hasMatch) {
    return { ...prev, _localMessages: prev._localMessages.map(
      (m) => 'clientId' in m && m.clientId === message.clientId ? message : m
    )}
  }
}
```

### Pattern 14: Shared Component Pattern
```tsx
// Instead of duplicating UI, use shared component
// Thread page → <PostCard> (same as Home/Profile)
// This ensures consistent icons, actions, behavior
```

---

## Bug 25: Chat Bubble — Content Shows Extra Trailing Space

**Date:** 2026-05-05
**Severity:** Medium

### Problem
When typing "1" and sending, the chat bubble displayed "1     " (with trailing spaces) making the bubble wider than the text.

### Root Cause
**Three issues combined:**

1. **Socket send used untrimmed content** — `sendMessage({ content })` sent the raw input instead of trimmed content. When server echoed back with `clientId`, the optimistic message was replaced with untrimmed server content.

2. **CSS `wordBreak: 'break-word'`** — This forces single characters to stretch and fill the entire line width.

3. **CSS `max-w-[70%]` on flex container** — The bubble column had `max-w-[70%] min-w-0` which stretched the bubble to fill available width.

### Solution

**1. Trim content before socket send:**
```tsx
// FABChatView.tsx - handleSend
sendMessage({
  conversationId: conversation.id,
  content: content.trim(),  // ← trim before sending
  clientId,
})
```

**2. Remove `wordBreak: 'break-word'` from bubble:**
```tsx
// BEFORE
style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}

// AFTER
style={{ overflowWrap: 'break-word' }}
```

**3. Use `width: fit-content` on bubble column:**
```tsx
// BEFORE
<div className="flex flex-col gap-0.5 max-w-[70%] min-w-0">

// AFTER
<div className="flex flex-col gap-0.5" style={{ width: 'fit-content', minWidth: 0 }}>
```

### Files Modified
- `client/src/components/chat/FABChatView.tsx`
- `client/src/components/chat/MessageBubble.tsx`

---

## Bug 26: Chat Auto-Scroll — First Message Doesn't Scroll to Bottom

**Date:** 2026-05-05
**Severity:** Medium

### Problem
When sending the first message in a chat, the container didn't scroll down — the message appeared but the view didn't follow. Subsequent messages scrolled correctly.

### Root Cause
`scrollIntoView({ behavior: 'smooth' })` runs **before** the DOM has actually painted the new message element. React's `useEffect` fires after state update, but the browser layout calculation happens before paint.

### Solution
Use `requestAnimationFrame` to ensure DOM has painted before scrolling:

```tsx
// BEFORE
useEffect(() => {
  if (isAtBottomRef.current) {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
}, [messages])

// AFTER
useEffect(() => {
  const el = containerRef.current
  if (!el) return

  const rafId = requestAnimationFrame(() => {
    if (!el) return

    if (isInitialMountRef.current) {
      // Initial mount: scroll immediately (no smooth delay)
      el.scrollTop = el.scrollHeight
      isInitialMountRef.current = false
    } else if (isAtBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  })
  return () => cancelAnimationFrame(rafId)
}, [messages])
```

**Key changes:**
- `requestAnimationFrame` defers scroll until after DOM paint
- Separate handling for initial mount vs subsequent updates
- Use `scrollTop = scrollHeight` for immediate scroll on first load
- Use `scrollTo({ behavior: 'smooth' })` for subsequent messages

### Files Modified
- `client/src/components/chat/MessageList.tsx`

### Key Insight
**`requestAnimationFrame` is essential for DOM-dependent scroll operations.** Any time you need to scroll to something that was just added to the DOM, defer with `rAF` to ensure the browser has painted first.

---

## Bug 27: FAB Chat — Avatar Still Occupies Space When Hidden

**Date:** 2026-05-05
**Severity:** Low

### Problem
When `showAvatar={false}` was passed to hide avatars in FAB chat, messages were still offset from the edge as if an invisible avatar was taking up space.

### Root Cause
The avatar `<div className="w-8 flex-shrink-0">` was always rendered (just with conditional content), leaving a 32px gap regardless of whether `showAvatar` was true.

### Solution
Conditionally render the avatar container, not just the content:

```tsx
// BEFORE — div always rendered, content conditionally hidden
<div className="w-8 flex-shrink-0">
  {!isMine && showAvatar && <AvatarBlock />}
</div>

// AFTER — entire div conditionally rendered
{!isMine && showAvatar && (
  <div className="w-8 flex-shrink-0">
    <AvatarBlock />
  </div>
)}
```

### Files Modified
- `client/src/components/chat/MessageBubble.tsx`

---

## Bug 28: Chat Message Alignment — Flex Margin Compensation

**Date:** 2026-05-05
**Severity:** Low

### Problem
Message bubbles had `ml-10` (40px left margin) or `mr-10` (40px right margin) to compensate for avatar space, even when avatars were hidden.

### Root Cause
The margin compensation classes were applied regardless of whether `showAvatar` was true or false.

### Solution
Remove margin compensation — once avatar containers are conditionally rendered, no compensation is needed:

```tsx
// BEFORE — margin compensation for invisible avatars
className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''} ${
  !shouldShowAvatarFlag && isMine ? 'ml-10' : ''
} ${!shouldShowAvatarFlag && !isMine ? 'mr-10' : ''}`}

// AFTER — no compensation needed
className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}
```

### Files Modified
- `client/src/components/chat/MessageList.tsx`

---

## Common Patterns for Chat Implementation

### Pattern 15: rAF Auto-Scroll
```tsx
useEffect(() => {
  const rafId = requestAnimationFrame(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight })
  })
  return () => cancelAnimationFrame(rafId)
}, [messages])
```

### Pattern 16: Conditional Container Rendering
```tsx
// WRONG — container always exists
<div className="w-8">{condition && <Content />}</div>

// CORRECT — container only exists when needed
{condition && <div className="w-8"><Content /></div>}
```

### Pattern 17: Flex Bubble Width
```tsx
// Bubble column should use fit-content to avoid stretching
<div className="flex flex-col" style={{ width: 'fit-content', minWidth: 0 }}>
  <Bubble />
</div>
```

### Pattern 18: Socket Trim Before Send
```tsx
// Always trim content before sending via socket
sendMessage({ content: content.trim(), clientId })
// Backend should also trim: content: dto.content?.trim() ?? ''
```

### Pattern 19: Optimistic Replace by clientId
```tsx
// When server echoes back with clientId, replace optimistic message
if ('clientId' in message && message.clientId) {
  const hasMatch = messages.some(m =>
    'clientId' in m && m.clientId === message.clientId
  )
  if (hasMatch) {
    return messages.map(m =>
      'clientId' in m && m.clientId === message.clientId ? message : m
    )
  }
}
```

### Pattern 20: FAB vs Page Chat — Shared MessageList
```tsx
// Both FAB and /messages page use same MessageList component
// FAB: showAvatar={false}, default padding
// Page: showAvatar={false}, default padding
// Just pass props to customize behavior
<MessageList
  messages={messages}
  currentUserId={currentUser.id}
  showAvatar={false}
  // or
  showAvatar={true}
  className="pr-0"  // optional override
/>
```

---

## Bug 21: Repost Banner — "You reposted" ใช้ currentUsername แทน loggedInUsername

**Date:** 2026-05-05
**Severity:** Medium

### Problem
Banner "You reposted" แสดงผิด logic — เมื่อ @three ดู profile @oneone ที่รีโพสต์โพสต์ของ @twotwo → เห็น "You reposted" แทนที่จะเป็น "One One reposted"

### Root Cause
`PostCard` เปรียบเทียบ `repostedBy.username === currentUsername` โดย `currentUsername` คือ username ของ profile ที่กำลังดู (เช่น `oneone`) ไม่ใช่ username ของคนที่ login อยู่ (เช่น `three`)

### Solution
1. เพิ่ม prop ใหม่ `loggedInUsername?: string` ให้ `PostCard`
2. เปลี่ยน logic เปรียบเทียบเป็น `repostedBy.username === loggedInUsername`
3. แสดง `displayName` แทน `@username` ใน banner
4. ทุก page ที่ใช้ `PostCard` ต้องส่ง `loggedInUsername`:
   - `profile/[username]/page.tsx`: ดึงจาก `authApi.me().data.username`
   - `home/page.tsx`: ส่ง `currentUser.username`
   - `following/page.tsx`: ส่ง `currentUser.username`
   - `hashtag/[tag]/page.tsx`: ส่ง `currentUser.username`

### Logic ที่ถูกต้อง
```
banner แสดงเมื่อ post มี repostedBy:
- repostedBy.username === loggedInUsername → "You reposted"
- อื่นๆ → "{reposter's displayName} reposted"
```

### Files Modified
- `client/src/components/posts/PostCard.tsx` — เพิ่ม prop, แก้ logic banner
- `client/src/app/profile/[username]/page.tsx` — ดึง + ส่ง loggedInUsername
- `client/src/app/home/page.tsx` — ส่ง loggedInUsername
- `client/src/app/following/page.tsx` — ส่ง loggedInUsername
- `client/src/app/hashtag/[tag]/page.tsx` — ส่ง loggedInUsername
