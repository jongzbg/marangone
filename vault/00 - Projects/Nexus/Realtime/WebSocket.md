# WebSocket Implementation

Real-time communication using Socket.IO via `@nestjs/websocket`.

## ChatGateway

Location: `server/src/chat/chat.gateway.ts`

### Configuration

```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  // ...
}
```

### Events

#### 1. `join_conversation`

Join a conversation room to receive messages.

```typescript
@SubscribeMessage('join_conversation')
async handleJoinConversation(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: string }
)
```

**Process:**
1. Verify user is participant in conversation
2. Join room: `conversation:{conversationId}`
3. Emit `joined` confirmation

---

#### 2. `leave_conversation`

Leave a conversation room.

```typescript
@SubscribeMessage('leave_conversation')
handleLeaveConversation(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: string }
)
```

**Process:**
1. Leave room: `conversation:{conversationId}`

---

#### 3. `send_message`

Send a message via WebSocket.

```typescript
@SubscribeMessage('send_message')
async handleSendMessage(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: {
    conversationId: string
    content?: string
    mediaUrl?: string
    clientId?: string    // For idempotency
  }
)
```

**Process:**
1. Validate user is participant
2. Save message via `ChatService.sendMessage()`
3. Emit `new_message` to all room participants

**Outbound event:**
```typescript
const room = `conversation:${data.conversationId}`
this.server.to(room).emit('new_message', message)
```

---

#### 4. `typing_start`

Notify others that user is typing.

```typescript
@SubscribeMessage('typing_start')
handleTypingStart(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: string }
)
```

**Outbound:** `user_typing` event to room (excluding sender)

---

#### 5. `typing_stop`

Notify others that user stopped typing.

```typescript
@SubscribeMessage('typing_stop')
handleTypingStop(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: string }
)
```

**Outbound:** `user_stopped_typing` event to room (excluding sender)

---

## Authentication

WebSocket connections are authenticated via JWT token.

```typescript
async handleConnection(client: Socket) {
  try {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token) {
      client.emit('error', { message: 'No token provided' })
      client.disconnect()
      return
    }

    const payload = this.jwtService.verify(token)
    client.data.userId = payload.id
    client.data.username = payload.username
  } catch {
    client.emit('error', { message: 'Invalid token' })
    client.disconnect()
  }
}
```

**Note:** JWT payload uses `id` (not `sub`)

---

## Room Management

Rooms follow naming convention: `conversation:{conversationId}`

```typescript
// Join
client.join(`conversation:${conversationId}`)

// Leave
client.leave(`conversation:${conversationId}`)

// Broadcast to room (including sender)
this.server.to(room).emit('event', data)

// Broadcast to room (excluding sender)
client.to(room).emit('event', data)
```

---

## Client Events Summary

| Client sends | Server emits |
|--------------|--------------|
| `join_conversation` | `joined` |
| `leave_conversation` | - |
| `send_message` | `new_message`, `message_error` |
| `typing_start` | `user_typing` |
| `typing_stop` | `user_stopped_typing` |

### Error Events (server → client)

```typescript
client.emit('error', { message: 'No token provided' })
client.emit('error', { message: 'Invalid token' })
client.emit('error', { message: 'Not authorized for this conversation' })
client.emit('message_error', { conversationId, clientId, error })
```

---

## Notifications WebSocket

Location: `server/src/notifications/notifications.gateway.ts` (TODO: not yet implemented)

### Configuration

```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway {
  // ...
}
```

### Client Connection

```typescript
const socket = io(`${API_BASE_URL}/notifications`, {
  auth: { token },
  transports: ['websocket'],
})

socket.on('new_notification', (notification) => {
  setUnreadCount(prev => prev + 1)
})
```

### Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `new_notification` | `{ id, type, actor, post, isRead, createdAt }` | ส่งเมื่อมีแจ้งเตือนใหม่ |

### Implementation Status

**TODO:** `NotificationsGateway` is not yet implemented. The frontend attempts to connect to `/notifications` namespace but there's no server-side handler. Real-time notifications rely on `refreshUnreadCount()` polling via `nexus:like-changed` custom event.

---

## Related Files

- `server/src/chat/chat.gateway.ts`
- `server/src/chat/chat.service.ts`