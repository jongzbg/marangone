# Chat Architecture

System design for real-time ephemeral messaging in Nexus.

## Overview

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Client    │◄──────────────────►│  ChatGateway │
└─────────────┘                    └──────┬──────┘
                                           │
┌─────────────┐                            ▼
│   Client    │◄──────────────────►  ChatService
└─────────────┘                    ┌──────┬──────┘
                                   │      │
                            ┌──────▼──┐  │  PrismaService
                            │   DB    │◄─┘
                            └──────▲──┘
                                   │
                            ┌──────┴──────┐
                            │ PostgreSQL │
                            └─────────────┘
```

## Message Flow

### Sending a Message

```
1. Client --WS--> join_conversation
   └─> Client joins room: conversation:{id}

2. Client --WS--> send_message { conversationId, content, clientId }
   └─> Gateway validates token
   └─> Gateway calls ChatService.sendMessage()

3. ChatService.sendMessage():
   ├─> Idempotency check (by clientId)
   ├─> Validate participant
   └─> DB Transaction:
       ├─> INSERT message (expiresAt = now + 24h)
       └─> UPDATE conversation (lastMessageAt, expiresAt)

4. ChatGateway --WS--> new_message to room
   └─> All participants receive the message
```

### Reading Messages

```
1. Client --REST--> GET /conversations/:id/messages
   ├─> Validate user is participant
   ├─> Cursor pagination
   └─> Return messages (createdAt DESC)

2. Client --REST--> POST /conversations/:id/read
   └─> Update lastReadAt for user
```

## Data Lifecycle

### Message Expiry

```
Message.createdAt ──────────────────────────────────► expiresAt (24h)
                              │
                              ▼
                    Auto-deleted by cleanup job
```

### Conversation Expiry

```
lastMessageAt ─────────────────────────────────► expiresAt (24h)
                           │
                           ▼
                 Auto-deleted by cleanup job
                 (also cascade-deletes messages)
```

## Cleanup Job

Runs every 5 minutes via `@Cron('*/5 * * * *')`

**Order of operations:**
1. DELETE FROM Message WHERE expiresAt < now
2. DELETE FROM Conversation WHERE expiresAt < now

**Why this order:**
- Messages deleted first (prevents orphan messages)
- Conversation deletion cascades to participants
- Referential integrity preserved

## Idempotency

Client generates a UUID (`clientId`) before sending:

```typescript
// Client side
const clientId = crypto.randomUUID()
socket.emit('send_message', { conversationId, content, clientId })

// Server side
if (dto.clientId) {
  const existing = await prisma.message.findUnique({ where: { clientId: dto.clientId } })
  if (existing) return existing  // Return existing, don't insert twice
}
```

## 1:1 Conversation Key Generation

Deterministic key ensures unique conversation per user pair:

```typescript
const sortedPair = [userId1, userId2].sort()  // Always same order
const uniqueUserPair = sortedPair.join(':')   // "userA:userB"
```

This prevents creating duplicate 1:1 conversations between the same two users.

## Indexes

```prisma
// Message queries
@@index([conversationId, createdAt(sort: Desc)])  // Get messages
@@index([expiresAt])                               // Cleanup job

// Conversation queries
@@index([lastMessageAt(sort: Desc)])               // List by recent
@@index([expiresAt])                               // Cleanup job

// Participant queries
@@index([userId])                                  // Find user's convos
@@index([lastReadAt])                              // Unread count
```

## Frontend Integration

### WebSocket Connection

```typescript
useEffect(() => {
  const socket = io('http://localhost:3001/chat', {
    auth: { token: localStorage.getItem('token') }
  })

  socket.on('new_message', (message) => {
    setMessages(prev => [...prev, message])
  })

  return () => socket.disconnect()
}, [])
```

### Optimistic Updates

```typescript
// 1. Optimistic render
setMessages(prev => [...prev, { ...pendingMessage, id: clientId, status: 'pending' }])

// 2. Send via WebSocket
socket.emit('send_message', { conversationId, content, clientId })

// 3. Server confirms, replaces pending
socket.on('new_message', (message) => {
  setMessages(prev => prev.map(m => m.id === clientId ? message : m))
})
```

## Security

1. **Authentication** - All WebSocket connections require valid JWT
2. **Authorization** - Every operation validates user is conversation participant
3. **Validation** - DTOs validated via `class-validator`

## Related Files

- `server/src/chat/chat.gateway.ts` - WebSocket handler
- `server/src/chat/chat.service.ts` - Business logic
- `server/src/chat/chat-cleanup.service.ts` - Cleanup logic
- `server/src/chat/chat-cleanup.task.ts` - Cron scheduler
- `server/prisma/schema.prisma` - Data models