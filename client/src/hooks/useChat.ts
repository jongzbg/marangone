'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'
import type {
  Message,
  Conversation,
  PendingMessage,
  ServerJoinedPayload,
  ServerNewMessagePayload,
  ServerMessageErrorPayload,
  ServerUserTypingPayload,
  ServerUserStoppedTypingPayload,
  ClientJoinConversationPayload,
  ClientLeaveConversationPayload,
  ClientSendMessagePayload,
  ClientTypingStartPayload,
  ClientTypingStopPayload,
} from '@/types/chat'

// ─── Typing state per conversation ───────────────────────────────────────────

export interface TypingUser {
  userId: string
  username: string
}

export interface ConversationTypingState {
  [conversationId: string]: TypingUser[]
}

// ─── Hook Options ─────────────────────────────────────────────────────────────

export interface UseChatOptions {
  /** Called whenever the server acks a new message */
  onMessage?: (message: Message, conversationId: string) => void
  /** Called when a send_message fails server-side */
  onMessageError?: (payload: ServerMessageErrorPayload) => void
  /** Called for any server-side error event */
  onError?: (message: string) => void
  /** Called when a user starts typing */
  onTypingStart?: (payload: ServerUserTypingPayload) => void
  /** Called when a user stops typing */
  onTypingStop?: (payload: ServerUserStoppedTypingPayload) => void
}

// ─── Hook Return ──────────────────────────────────────────────────────────────

export interface UseChatReturn {
  /** Whether the socket is currently connected */
  isConnected: boolean
  /** Live typing state: which users are typing in each conversation */
  typingState: ConversationTypingState
  /** Join a conversation room on the server */
  joinConversation: (conversationId: string) => void
  /** Leave a conversation room on the server */
  leaveConversation: (conversationId: string) => void
  /**
   * Send a message optimistically.
   * The caller should update local UI state immediately; the real message
   * (with server-assigned id and canonical timestamps) will arrive via
   * onMessage once the server acks it.
   */
  sendMessage: (payload: Omit<ClientSendMessagePayload, 'clientId'> & { clientId?: string }) => void
  /** Notify the server (and other clients) that the current user started typing */
  startTyping: (conversationId: string) => void
  /** Notify the server (and other clients) that the current user stopped typing */
  stopTyping: (conversationId: string) => void
  /**
   * Map of active conversations currently joined.
   * Useful to avoid double-joining on re-renders.
   */
  activeConversations: Set<string>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useChat – high-level Socket.IO interface for real-time chat.
 *
 * Manages:
 *  - socket connection (singleton via getSocket)
 *  - conversation room join / leave
 *  - message emission and typing events
 *  - in-memory typing state per conversation
 *
 * Usage:
 * ```
 * const { isConnected, sendMessage, startTyping, stopTyping } = useChat({
 *   onMessage: (msg, convId) => { … }
 * })
 * ```
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { onMessage, onMessageError, onError, onTypingStart, onTypingStop } = options

  const [isConnected, setIsConnected] = useState(false)
  const [typingState, setTypingState] = useState<ConversationTypingState>({})

  // Track which conversations we have joined (avoids double-join)
  const activeConversationsRef = useRef<Set<string>>(new Set())

  // Guard against processing the same message twice (e.g., socket reconnect)
  const processedMessageIdsRef = useRef<Set<string>>(new Set())

  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null)

  // ── Socket lifecycle ────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = getSocket()
    socketRef.current = socket

    function onConnect() {
      setIsConnected(true)
    }

    function onDisconnect() {
      setIsConnected(false)
      // Clear typing state on disconnect to avoid stale indicators
      setTypingState({})
    }

    // ── Server events ─────────────────────────────────────────────────────────

    function handleJoined(payload: ServerJoinedPayload) {
      activeConversationsRef.current.add(payload.conversationId)
    }

    function handleNewMessage(payload: ServerNewMessagePayload) {
      // Guard: skip if already processed (prevents duplicates from socket reconnect)
      if (payload.message.id && processedMessageIdsRef.current.has(payload.message.id)) return
      if (payload.message.id) processedMessageIdsRef.current.add(payload.message.id)
      onMessage?.(payload.message, payload.message.conversationId)
    }

    function handleMessageError(payload: ServerMessageErrorPayload) {
      onMessageError?.(payload)
    }

    function handleUserTyping(payload: ServerUserTypingPayload) {
      setTypingState((prev) => {
        const existing = prev[payload.conversationId] ?? []
        if (existing.some((u) => u.userId === payload.userId)) return prev
        return {
          ...prev,
          [payload.conversationId]: [...existing, { userId: payload.userId, username: payload.username }],
        }
      })
      onTypingStart?.(payload)
    }

    function handleUserStoppedTyping(payload: ServerUserStoppedTypingPayload) {
      setTypingState((prev) => {
        const existing = prev[payload.conversationId] ?? []
        const filtered = existing.filter((u) => u.userId !== payload.userId)
        if (filtered.length === existing.length) return prev
        return { ...prev, [payload.conversationId]: filtered }
      })
      onTypingStop?.(payload)
    }

    function handleError(payload: { message: string }) {
      onError?.(payload.message)
    }

    // ── Register listeners ────────────────────────────────────────────────────

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('joined', handleJoined)
    socket.on('new_message', handleNewMessage)
    socket.on('message_error', handleMessageError)
    socket.on('user_typing', handleUserTyping)
    socket.on('user_stopped_typing', handleUserStoppedTyping)
    socket.on('error', handleError)

    if (socket.connected) setIsConnected(true)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('joined', handleJoined)
      socket.off('new_message', handleNewMessage)
      socket.off('message_error', handleMessageError)
      socket.off('user_typing', handleUserTyping)
      socket.off('user_stopped_typing', handleUserStoppedTyping)
      socket.off('error', handleError)

      // Leave all rooms on unmount
      activeConversationsRef.current.forEach((convId) => {
        socket.emit('leave_conversation', { conversationId: convId } satisfies ClientLeaveConversationPayload)
      })
      activeConversationsRef.current.clear()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Public API ──────────────────────────────────────────────────────────────

  const joinConversation = useCallback((conversationId: string) => {
    if (activeConversationsRef.current.has(conversationId)) return
    const socket = socketRef.current
    if (!socket) return
    socket.emit('join_conversation', { conversationId } satisfies ClientJoinConversationPayload)
    activeConversationsRef.current.add(conversationId)
  }, [])

  const leaveConversation = useCallback((conversationId: string) => {
    if (!activeConversationsRef.current.has(conversationId)) return
    const socket = socketRef.current
    if (!socket) return
    socket.emit('leave_conversation', { conversationId } satisfies ClientLeaveConversationPayload)
    activeConversationsRef.current.delete(conversationId)
    // Clean up typing state for this conversation
    setTypingState((prev) => {
      const next = { ...prev }
      delete next[conversationId]
      return next
    })
  }, [])

  const sendMessage = useCallback(
    (payload: Omit<ClientSendMessagePayload, 'clientId'> & { clientId?: string }) => {
      const socket = socketRef.current
      if (!socket) return
      socket.emit('send_message', payload satisfies ClientSendMessagePayload)
    },
    []
  )

  const startTyping = useCallback((conversationId: string) => {
    const socket = socketRef.current
    if (!socket) return
    socket.emit('typing_start', { conversationId } satisfies ClientTypingStartPayload)
  }, [])

  const stopTyping = useCallback((conversationId: string) => {
    const socket = socketRef.current
    if (!socket) return
    socket.emit('typing_stop', { conversationId } satisfies ClientTypingStopPayload)
  }, [])

  return {
    isConnected,
    typingState,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    activeConversations: activeConversationsRef.current,
  }
}
