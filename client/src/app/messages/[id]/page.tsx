'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import ChatWindow from '@/components/chat/ChatWindow'
import { MessageSkeleton } from '@/components/Skeleton'
import { chatApi } from '@/lib/api'
import { authApi } from '@/lib/api'
import { useChat } from '@/hooks/useChat'
import type { Message, PendingMessage, ChatUser } from '@/types/chat'

type ChatMessage = Message | PendingMessage

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateClientId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConversationPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const conversationId = params.id

  // ── Core state ────────────────────────────────────────────────────────────

  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null)
  const [conversation, setConversation] = useState<{
    id: string
    isGroup: boolean
    participants: Array<{
      userId: string
      user: ChatUser
      lastReadAt: string | null
      joinedAt: string
    }>
  } | null>(null)

  // ChatMessages holds both confirmed (Message) and optimistic (PendingMessage) items
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // ── useChat ─────────────────────────────────────────────────────────────────

  const handleNewMessage = useCallback(
    (message: Message) => {
      setMessages((prev) => {
        // If we have a matching optimistic message, replace it
        const clientId = message.clientId
        if (clientId && prev.some((m) => 'clientId' in m && m.clientId === clientId)) {
          return prev.map((m) =>
            'clientId' in m && m.clientId === clientId
              ? { ...message }
              : m
          )
        }
        // Otherwise append (incoming from other user)
        return [...prev, { ...message }]
      })
    },
    []
  )

  const handleMessageError = useCallback(
    (payload: { conversationId: string; clientId: string; message: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          'clientId' in m && m.clientId === payload.clientId
            ? { ...m, status: 'error' as const, errorMessage: payload.message }
            : m
        )
      )
    },
    []
  )

  const { sendMessage, joinConversation, leaveConversation, startTyping, stopTyping, typingState } =
    useChat({
      onMessage: handleNewMessage,
      onMessageError: handleMessageError,
    })

  // ── Fetch current user on mount ─────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    authApi
      .me()
      .then((res) => {
        setCurrentUser(res.data as ChatUser)
      })
      .catch(() => {
        router.push('/login')
      })
  }, [router])

  // ── Load conversation + initial messages on mount ────────────────────────────

  useEffect(() => {
    if (!conversationId || !currentUser) return

    setLoading(true)

    chatApi
      .getConversation(conversationId)
      .then((res) => {
        setConversation(res.data)
      })
      .catch(() => {
        router.push('/messages')
        return
      })
      .finally(() => setLoading(false))

    chatApi
      .getMessages(conversationId)
      .then((res) => {
        // API returns newest-first (DESC); reverse for oldest-at-top display
        const msgs = (res.data?.messages as Message[]) || []
        setMessages([...msgs].reverse())
        setHasMore(!!res.data?.nextCursor)
      })
      .catch(() => {})

    // Mark conversation as read
    chatApi
      .markAsRead(conversationId)
      .then(() => {
        window.dispatchEvent(
          new CustomEvent('messages_read', { detail: { conversationId } })
        )
      })
      .catch(() => {})
  }, [conversationId, currentUser, router])

  // ── Join / leave conversation room ──────────────────────────────────────────

  useEffect(() => {
    if (!conversationId || loading) return

    joinConversation(conversationId)
    return () => {
      leaveConversation(conversationId)
    }
  }, [conversationId, loading, joinConversation, leaveConversation])

  // ── Infinite scroll: load older messages ───────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0 || !conversationId) return

    setLoadingMore(true)

    try {
      // oldest message is at index 0 (after reversal)
      const oldestMessage = messages[0] as Message
      const res = await chatApi.getMessages(conversationId, oldestMessage.id)
      const olderMessages: Message[] = (res.data?.messages || []) as Message[]
      // Prepend older messages (they come newest-first too, so reverse)
      setMessages((prev) => [...olderMessages.reverse(), ...prev])
      setHasMore(!!res.data?.nextCursor)
    } catch {
      // non-fatal — silently ignore
    } finally {
      setLoadingMore(false)
    }
  }, [conversationId, hasMore, loadingMore, messages])

  // ── Send message ─────────────────────────────────────────────────────────────

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!conversationId || !currentUser) return

      const clientId = generateClientId()

      const optimisticMessage: PendingMessage = {
        clientId,
        conversationId,
        senderId: currentUser.id,
        sender: currentUser,
        content,
        createdAt: new Date().toISOString(),
        status: 'pending',
      }

      // Optimistically append
      setMessages((prev) => [...prev, optimisticMessage])

      // Stop typing
      stopTyping(conversationId)

      // Emit via socket
      sendMessage({ conversationId, content, clientId })

      // REST fallback — if socket fails or socket not connected
      chatApi
        .sendMessage(conversationId, { content, clientId })
        .catch(() => {
          // Error will arrive via message_error socket event; handled above
        })
    },
    [conversationId, currentUser, sendMessage, stopTyping]
  )

  // ── Retry failed message ─────────────────────────────────────────────────────

  useEffect(() => {
    const handleRetry = (e: Event) => {
      const { clientId, content } = (e as CustomEvent).detail as {
        clientId: string
        content?: string | null
      }
      if (!content || !conversationId) return

      const newClientId = generateClientId()

      setMessages((prev) =>
        prev.map((m) =>
          'clientId' in m && m.clientId === clientId
            ? { ...m, clientId: newClientId, status: 'pending' as const }
            : m
        )
      )

      sendMessage({ conversationId, content, clientId: newClientId })
    }

    window.addEventListener('chat_retry_message', handleRetry)
    return () => window.removeEventListener('chat_retry_message', handleRetry)
  }, [conversationId, sendMessage])

  // ── Typing users for this conversation ──────────────────────────────────────

  const typingUsers = conversationId
    ? typingState[conversationId] ?? []
    : []

  // ── Other participant (for header) ──────────────────────────────────────────

  const otherParticipant = conversation?.participants.find(
    (p) => p.userId !== currentUser?.id
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading || !currentUser) {
    return (
      <MainLayout>
        <MessageSkeleton />
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <ChatWindow
        messages={messages}
        currentUserId={currentUser.id}
        otherUser={otherParticipant?.user}
        onSendMessage={handleSendMessage}
        onLoadMore={loadMore}
        hasMore={hasMore}
        loadingMore={loadingMore}
        typingUsers={typingUsers}
        onTypingStart={() => startTyping(conversationId)}
        onTypingStop={() => stopTyping(conversationId)}
      />
    </MainLayout>
  )
}
