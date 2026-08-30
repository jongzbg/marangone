# Chat Implementation Checklist

Verify implementation against the 10 design steps.

---

## Step 1: Database Design ✅

- [x] Conversation table (id, isGroup, lastMessageAt, expiresAt, createdAt, updatedAt)
- [x] ConversationParticipant table (conversationId, userId, lastReadAt, joinedAt)
- [x] Message table (id, conversationId, senderId, content, mediaUrl, createdAt, expiresAt)
- [x] uniqueUserPair for 1-1 conversations (deterministic key)
- [x] Indexes:
  - [x] `@@index([conversationId, createdAt(sort: Desc)])`
  - [x] `@@index([expiresAt])`
  - [x] `@@index([lastMessageAt(sort: Desc)])`
  - [x] `@@index([userId])`
  - [x] `@@index([lastReadAt])`

**Status:** ✅ DONE - Implemented in `server/prisma/schema.prisma`

---

## Step 2: Backend WebSocket ✅

- [x] WebSocket server with Socket.IO (`@nestjs/websocket`, `@nestjs/platform-socket.io`)
- [x] JWT authentication middleware for socket connections
- [x] Room-based messaging system

**Status:** ✅ DONE - Implemented in `server/src/chat/chat.gateway.ts`

---

## Step 3: Message Flow ✅

- [x] Validate user is authenticated (JWT verification in `handleConnection`)
- [x] Validate user is participant in conversation (`getConversation` check)
- [x] Database transaction for insert message + update conversation (`$transaction`)
- [x] Idempotency via `clientId` (`@@unique([clientId])`)
- [x] Emit `new_message` to all participants in room
- [x] Server timestamp (`createdAt`) for ordering

**Status:** ✅ DONE - Implemented in `ChatService.sendMessage()` and `ChatGateway`

---

## Step 4: Auto Cleanup ✅

- [x] Cron job runs every 5 minutes (`@Cron('*/5 * * * *')`)
- [x] Delete expired messages first (`ChatCleanupService.cleanupExpiredMessages()`)
- [x] Delete expired conversations second
- [x] Referential integrity preserved (Cascade delete)

**Status:** ✅ DONE - Implemented in `chat-cleanup.task.ts` and `chat-cleanup.service.ts`

---

## Step 5: API Endpoints ✅

- [x] `GET /conversations` - return user's conversations sorted by lastMessageAt DESC
- [x] `GET /conversations/:id/messages` - cursor pagination, createdAt DESC
- [x] `POST /conversations` - create or return existing 1-1 conversation

**Status:** ✅ DONE - Implemented in `server/src/chat/chat.controller.ts`

---

## Step 6: Frontend

**Status:** ⚠️ TODO - Needs implementation in Next.js client

Required:
- [ ] WebSocket connection on app load
- [ ] Join room when opening conversation
- [ ] Listen to `new_message` event
- [ ] Optimistic UI with pending status

---

## Step 7: Read Status & Unread Count ✅

- [x] Update `lastReadAt` when opening conversation (`markAsRead`)
- [x] Unread count = messages where `createdAt > lastReadAt` AND `senderId != currentUser`

**Status:** ✅ DONE - Implemented in `ChatService.markAsRead()` and `ChatService.getUnreadCount()`

---

## Step 8: Performance Optimization ✅

- [x] Index: `Message(conversationId, createdAt DESC)`
- [x] Index: `Message(expiresAt)`
- [x] Index: `Conversation(lastMessageAt DESC)`
- [x] Index: `Conversation(expiresAt)`

**Status:** ✅ DONE - Defined in Prisma schema

---

## Step 9: Security ✅

- [x] Validate user is participant before sending messages (`sendMessage` -> participant check)
- [x] Validate user is participant before fetching messages (`getMessages` -> `getConversation`)
- [x] Reject unauthorized access (`ForbiddenException`)

**Status:** ✅ DONE - All methods validate participant status

---

## Step 10: Constraints ✅

- [x] Messages auto-deleted after 24 hours (expiresAt + cleanup job)
- [x] Conversations auto-deleted after 24h inactivity (expiresAt + cleanup job)
- [x] Support 1-1 chat (getOrCreate1to1 with uniqueUserPair)
- [ ] Group chat (partially done - model supports it, API endpoint not complete)
- [x] Prevent duplicate 1:1 conversations (uniqueUserPair)
- [x] Idempotent message sending (clientId + @@unique)
- [x] Correct message ordering (createdAt DESC)

**Status:** ⚠️ MOSTLY DONE
- Group chat: data model supports it, but `POST /conversations` for groups not fully implemented

---

## Summary

| Step | Description | Status |
|------|-------------|--------|
| 1 | Database Design | ✅ Done |
| 2 | Backend WebSocket | ✅ Done |
| 3 | Message Flow | ✅ Done |
| 4 | Auto Cleanup | ✅ Done |
| 5 | API Endpoints | ✅ Done |
| 6 | Frontend | ⚠️ TODO |
| 7 | Read Status & Unread | ✅ Done |
| 8 | Performance Indexes | ✅ Done |
| 9 | Security | ✅ Done |
| 10 | Constraints | ⚠️ Mostly Done |

**Overall:** Backend is complete. Frontend integration (Step 6) needs to be implemented in Next.js client.