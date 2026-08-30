// ─── User ────────────────────────────────────────────────────────────────────

export interface ChatUser {
  id: string
  username: string
  displayName: string
  avatarUrl?: string | null
}

// ─── Participant ─────────────────────────────────────────────────────────────

export interface ConversationParticipant {
  userId: string
  user: ChatUser
  lastReadAt: string | null   // ISO 8601
  joinedAt: string            // ISO 8601
}

// ─── Message ─────────────────────────────────────────────────────────────────

export interface Message {
  id: string
  conversationId: string
  senderId: string
  sender?: ChatUser
  content?: string | null
  mediaUrl?: string | null
  createdAt: string           // ISO 8601
  expiresAt?: string | null   // ISO 8601 (disappearing messages)
  clientId?: string           // temp ID set by client before server ack
}

// ─── Conversation ────────────────────────────────────────────────────────────

export interface Conversation {
  id: string
  isGroup: boolean
  lastMessageAt: string | null // ISO 8601
  participants: ConversationParticipant[]
  lastMessage?: Message | null
  expiresAt?: string | null    // ISO 8601 (disappearing messages)
  unreadCount?: number         // returned by backend GET /conversations
}

// ─── Pending / Optimistic Message ────────────────────────────────────────────

/**
 * Local-only message used for optimistic UI updates while a real message
 * is pending server acknowledgement.
 */
export interface PendingMessage {
  clientId: string          // generated UUID, also sent as `clientId` on the wire
  conversationId: string
  senderId: string
  sender?: ChatUser
  content?: string | null
  mediaUrl?: string | null
  createdAt: string         // client-side timestamp
  expiresAt?: string | null
  status: 'pending' | 'error'
  errorMessage?: string
}

// ─── Socket Event Payloads ───────────────────────────────────────────────────

/** Emitted by server on successful join */
export interface ServerJoinedPayload {
  conversationId: string
}

/** Emitted by server when a new message arrives */
export interface ServerNewMessagePayload {
  message: Message
}

/** Emitted by server when send_message failed */
export interface ServerMessageErrorPayload {
  conversationId: string
  clientId: string
  message: string
}

/** Emitted by server when a user starts typing */
export interface ServerUserTypingPayload {
  conversationId: string
  userId: string
  username: string
}

/** Emitted by server when a user stops typing */
export interface ServerUserStoppedTypingPayload {
  conversationId: string
  userId: string
}

/** Generic server error */
export interface ServerErrorPayload {
  message: string
}

// ─── Client → Server Event Payloads ─────────────────────────────────────────

export interface ClientJoinConversationPayload {
  conversationId: string
}

export interface ClientLeaveConversationPayload {
  conversationId: string
}

export interface ClientSendMessagePayload {
  conversationId: string
  content?: string
  mediaUrl?: string
  clientId?: string
}

export interface ClientTypingStartPayload {
  conversationId: string
}

export interface ClientTypingStopPayload {
  conversationId: string
}
