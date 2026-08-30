# Notification Service

## Overview

ระบบแจ้งเตือนแบ่งออกเป็น 2 ส่วนหลัก:
1. **Notification Bell (🔔)** - แจ้งเตือน LIKE, COMMENT, REPOST, QUOTE, FOLLOW
2. **Message Badge (✉️)** - แจ้งเตือนข้อความใหม่ (แยกออกต่างหาก)

## Notification Types

```typescript
type NotificationType = 'LIKE' | 'COMMENT' | 'REPOST' | 'QUOTE' | 'FOLLOW' | 'MESSAGE'
```

| Type | Description | Displayed in Bell? |
|------|-------------|-------------------|
| LIKE | คนอื่นกดไลค์โพสต์เรา | ✅ |
| COMMENT | คนอื่นคอมเมนต์โพสต์เรา | ✅ |
| REPOST | คนอื่นรีโพสต์โพสต์เรา | ✅ |
| QUOTE | คนอื่นอ้างอิงโพสต์เรา | ✅ |
| FOLLOW | คนอื่นติดตามเรา | ✅ |
| MESSAGE | มีข้อความใหม่ในแชท | ❌ (แยกไป Message Badge แล้ว) |

## Database Schema

```prisma
model Notification {
  id              String           @id @default(cuid())
  type            NotificationType
  userId          String           // ผู้รับการแจ้งเตือน
  actorId         String           // คนที่ทำการกระทำ
  postId          String?          // โพสต์ที่เกี่ยวข้อง
  messageId       String?          // ข้อความที่เกี่ยวข้อง
  conversationId  String?           // การสนทนาที่เกี่ยวข้อง
  isRead          Boolean          @default(false)
  createdAt       DateTime         @default(now())

  @@index([userId, isRead, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
}
```

## Backend Service

**File:** `server/src/notifications/notifications.service.ts`

### Key Methods

| Method | Description |
|--------|-------------|
| `create(data)` | สร้างแจ้งเตือนใหม่ (ไม่แจ้งตัวเอง) |
| `getNotifications(userId, cursor, limit)` | ดึงรายการแจ้งเตือน (exclude MESSAGE) |
| `getUnreadCount(userId)` | นับ unread (exclude MESSAGE) |
| `getUnreadMessageCount(userId)` | นับ unread MESSAGE เท่านั้น |
| `markAsRead(userId, ids?)` | ทำเครื่องหมายอ่าน (ถ้าไม่มี ids = ทั้งหมด, exclude MESSAGE) |
| `markOneAsRead(id, userId)` | ทำเครื่องหมายอ่าน 1 รายการ |
| `notifyLike(userId, actorId, postId)` | สร้างแจ้งเตือนไลค์ |
| `notifyComment(userId, actorId, postId)` | สร้างแจ้งเตือนคอมเมนต์ |
| `notifyRepost(userId, actorId, postId)` | สร้างแจ้งเตือนรีโพสต์ |
| `notifyFollow(userId, actorId)` | สร้างแจ้งเตือนติดตาม |

### Important: Exclude MESSAGE from Bell

```typescript
// getNotifications - exclude MESSAGE
where: { userId, type: { not: 'MESSAGE' }, ... }

// getUnreadCount - exclude MESSAGE
where: { userId, isRead: false, type: { not: 'MESSAGE' } }

// markAsRead - exclude MESSAGE
where: { userId, isRead: false, type: { not: 'MESSAGE' } }
```

## Frontend Implementation

### useNotifications Hook

**File:** `client/src/hooks/useNotifications.ts`

```typescript
const { unreadCount, markAsRead, decrementUnreadCount, refreshUnreadCount } = useNotifications()
```

| Return | Type | Description |
|--------|------|-------------|
| `unreadCount` | number | จำนวนที่ยังไม่อ่าน (exclude MESSAGE) |
| `markAsRead` | () => void | ทำเครื่องหมายอ่านทั้งหมด → set 0 |
| `decrementUnreadCount` | () => void | ลดลง 1 (ใช้ตอนกดอ่าน 1 รายการ) |
| `refreshUnreadCount` | () => void | ดึงข้อมูลใหม่จาก server |

### Header Integration

**File:** `client/src/components/layout/Header.tsx`

```typescript
// Notifications hook - bell icon
const { unreadCount, markAsRead, decrementUnreadCount, refreshUnreadCount } = useNotifications({...})

// Separate state for message badge
const [messageUnreadCount, setMessageUnreadCount] = useState(0)

// Pass two callbacks to NotificationDropdown
<NotificationDropdown
  onClose={...}
  onMarkAllAsRead={markAsRead}        // set to 0
  onMarkOneAsRead={decrementUnreadCount} // -1
/>
```

### NotificationDropdown

**File:** `client/src/components/NotificationDropdown.tsx`

```typescript
interface NotificationDropdownProps {
  onClose: () => void
  onMarkAllAsRead: () => void   // อ่านทั้งหมด → badge = 0
  onMarkOneAsRead: () => void    // อ่าน 1 รายการ → badge - 1
}
```

**Bug Fix:** ใช้ `onMarkOneAsRead` แทน `onMarkAsRead` ตอนกดอ่านรายการเดียว เพราะ `markAsRead` จะ set เป็น 0 ทันที

## Where Notifications Are Created

### Like Notification
```typescript
// server/src/posts/posts.service.ts - toggleLike()
if (post && post.userId !== userId) {
  await this.prisma.notification.create({
    data: { type: 'LIKE', userId: post.userId, actorId: userId, postId },
  });
}
```

### Comment Notification
```typescript
// server/src/posts/posts.service.ts - createComment()
if (post.userId !== userId) {
  await this.prisma.notification.create({
    data: { type: 'COMMENT', userId: post.userId, actorId: userId, postId },
  });
}
```

### Repost Notification
```typescript
// server/src/posts/posts.service.ts - repost()
if (post && post.userId !== userId) {
  await this.prisma.notification.create({
    data: { type: 'REPOST', userId: post.userId, actorId: userId, postId },
  });
}
```

### Quote Notification
```typescript
// server/src/posts/posts.service.ts - quotePost()
if (quoted.userId !== userId) {
  await this.prisma.notification.create({
    data: { type: 'QUOTE', userId: quoted.userId, actorId: userId, postId },
  });
}
```

### Follow Notification
```typescript
// server/src/users/users.service.ts - follow()
await this.prisma.notification.create({
  data: { type: 'FOLLOW', userId: targetUserId, actorId: currentUserId },
});
```

### Message Notification (WebSocket only)
```typescript
// server/src/chat/chat.service.ts - createMessage()
await this.notificationsService.notifyMessage(conversationId, recipientId, senderId, message.id);
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | ดึงรายการแจ้งเตือน |
| GET | `/notifications/unread-count` | จำนวน unread (exclude MESSAGE) |
| GET | `/notifications/unread-message-count` | จำนวน unread MESSAGE |
| POST | `/notifications/read` | ทำเครื่องหมายอ่านทั้งหมด (exclude MESSAGE) |
| POST | `/notifications/:id/read` | ทำเครื่องหมายอ่าน 1 รายการ |

## Key Design Decisions

1. **MESSAGE แยกออกจาก Bell** - เพราะมี icon message แยกแล้ว ซึ่งนับ unread conversation
2. **decrementUnreadCount vs markAsRead** - ป้องกันการ set 0 ทันทีเมื่อกดอ่านแค่ 1 รายการ
3. **WebSocket for Real-time** - ใช้ Socket.IO ส่ง new_notification event ไปยัง client
4. **Don't notify yourself** - เช็ค `if (userId !== actorId)` ก่อนสร้าง notification
