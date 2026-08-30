# Chat Service

Real-time messaging service handling conversations, messages, and read status.

## Data Models

### Conversation
```typescript
interface Conversation {
  id: string
  isGroup: boolean
  lastMessageAt: Date
  expiresAt: Date          // Auto-delete after 24h inactivity
  createdAt: Date
  updatedAt: Date
  uniqueUserPair?: string  // For 1:1 conversations (sorted userId pair)
}
```

### ConversationParticipant
```typescript
interface ConversationParticipant {
  conversationId: string
  userId: string
  lastReadAt: Date | null  // When user last opened the conversation
  joinedAt: Date
}
```

### Message
```typescript
interface Message {
  id: string
  clientId?: string        // For idempotency (client-generated UUID)
  conversationId: string
  senderId: string
  content: string | null
  mediaUrl: string | null
  createdAt: Date
  expiresAt: Date          // Auto-delete after 24h
}
```

---

## Methods

### getUserConversations

Get all conversations for a user with unread counts.

```typescript
async getUserConversations(userId: string): Promise<{
  conversations: ConversationWithDetails[]
  nextCursor: string | null
}>
```

**Features:**
- Returns conversations where user is a participant
- Includes participants, last message, unread count
- Sorted by `lastMessageAt` DESC

---

### getOrCreate1to1

Create or return existing 1:1 conversation.

```typescript
async getOrCreate1to1(userId: string, otherUserId: string): Promise<Conversation>
```

**Process:**
1. Sort `[userId, otherUserId]` to create deterministic `uniqueUserPair`
2. Search for existing conversation with that pair
3. If exists, verify user is participant (add if not)
4. If not exists, create new conversation

**Key Code:**
```typescript
const sortedPair = [userId, otherUserId].sort()
const uniqueUserPair = sortedPair.join(':')
```

---

### createGroupConversation

Create a group conversation.

```typescript
async createGroupConversation(
  userId: string,
  participantIds: string[],
  name?: string
): Promise<Conversation>
```

---

### getConversation

Get single conversation with participants.

```typescript
async getConversation(conversationId: string, userId: string): Promise<Conversation>
```

**Security:** Throws `ForbiddenException` if user is not a participant

---

### getMessages

Get messages with cursor pagination.

```typescript
async getMessages(
  conversationId: string,
  userId: string,
  cursor?: string,
  limit?: number
): Promise<{ messages: Message[]; nextCursor: string | null }>
```

**Features:**
- Validates user is participant
- Cursor-based pagination (default 20, max 100)
- Ordered by `createdAt DESC`
- Includes sender info

---

### sendMessage

Send a message in a conversation.

```typescript
async sendMessage(
  conversationId: string,
  senderId: string,
  dto: { clientId?: string; content?: string; mediaUrl?: string }
): Promise<Message>
```

**Process:**
1. **Idempotency check** - If `clientId` provided, return existing message
2. **Participant validation** - Verify sender is in conversation
3. **Transaction:**
   - Create message with `expiresAt = now + 24h`
   - Update `Conversation.lastMessageAt = now`
   - Update `Conversation.expiresAt = now + 24h`

**Implementation:**
```typescript
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

const result = await this.prisma.$transaction(async (tx) => {
  const message = await tx.message.create({
    data: { clientId, conversationId, senderId, content, mediaUrl, expiresAt }
  })
  await tx.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: message.createdAt, expiresAt }
  })
  return message
})
```

---

### markAsRead

Mark conversation as read for a user.

```typescript
async markAsRead(conversationId: string, userId: string): Promise<{ success: true }>
```

**Implementation:**
```typescript
await this.prisma.conversationParticipant.update({
  where: { conversationId_userId: { conversationId, userId } },
  data: { lastReadAt: new Date() }
})
```

---

### getUnreadCount

Get unread message count for a conversation.

```typescript
async getUnreadCount(conversationId: string, userId: string): Promise<{ unreadCount: number }>
```

**Logic:**
```typescript
const count = await this.prisma.message.count({
  where: {
    conversationId,
    senderId: { not: userId },
    createdAt: { gt: lastReadAt }
  }
})
```

---

## API Endpoints

```
GET    /conversations              # List user's conversations
POST   /conversations              # Create/get 1:1 conversation
GET    /conversations/:id           # Get single conversation
GET    /conversations/:id/messages # Get messages (cursor pagination)
POST   /conversations/:id/messages # Send message
POST   /conversations/:id/read     # Mark as read
GET    /conversations/:id/unread-count # Get unread count
```

---

## Related Files

- `server/src/chat/chat.service.ts`
- `server/src/chat/chat.controller.ts`
- `server/src/chat/chat.gateway.ts`
- `server/prisma/schema.prisma`