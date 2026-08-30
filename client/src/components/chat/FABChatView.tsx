'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { chatApi } from '@/lib/chatApi'
import { authApi } from '@/lib/api'
import { getAvatarUrl } from '@/lib/avatarUtils'
import { useChat } from '@/hooks/useChat'
import { useFABChat } from '@/hooks/useFABChat'
import MessageList from './MessageList'
import type { Message, PendingMessage, Conversation, ChatUser } from '@/types/chat'

type ChatMessage = Message | PendingMessage

interface FetchedConversation extends Conversation {
  _localMessages: ChatMessage[]
  _hasMore: boolean
  _loadingMore: boolean
  _cursor?: string
}

export default function FABChatView() {
  const { activeConversationId, closePanel, openPanel, markActiveChatAsRead } = useFABChat()
  const [conversation, setConversation] = useState<FetchedConversation | null>(null)
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [otherUser, setOtherUser] = useState<ChatUser | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Real-time messages via useChat ───────────────────────────────────────

  const { joinConversation, leaveConversation, sendMessage, startTyping, stopTyping } = useChat({
    onMessage: (message, conversationId) => {
      if (message.conversationId !== conversationId) return
      setConversation((prev) => {
        if (!prev) return prev

        // If confirmed message replaces an optimistic one (match by clientId),
        // replace it so the server's content (trimmed) is used.
        if ('clientId' in message && message.clientId) {
          const hasMatch = prev._localMessages.some((m) =>
            'clientId' in m && m.clientId === message.clientId
          )
          if (hasMatch) {
            return {
              ...prev,
              _localMessages: prev._localMessages.map((m) =>
                'clientId' in m && m.clientId === message.clientId ? message : m
              ),
            }
          }
        }

        // New message (not a replacement)
        if (
          prev._localMessages.some(
            (m) =>
              ('id' in m && 'id' in message && m.id === message.id) ||
              ('clientId' in m && 'clientId' in message && m.clientId === message.clientId)
          )
        )
          return prev
        const updated = {
          ...prev,
          _localMessages: [...prev._localMessages, message],
        }
        updated.lastMessage = message
        updated.lastMessageAt = message.createdAt
        return updated
      })

      // Notify other components (messages page, etc.) that this conversation has a new message.
      // Only dispatch for confirmed messages (have server 'id'), not pending ones.
      if ('id' in message && (message as any).id) {
        window.dispatchEvent(new CustomEvent('fab_message_sent', {
          detail: {
            conversationId,
            message,
          },
        }))
      }
    },
  })

  // ── Load conversation + messages + current user ──────────────────────────

  useEffect(() => {
    if (!activeConversationId) return

    let cancelled = false

    const load = async () => {
      try {
        const [convRes, meRes] = await Promise.all([
          chatApi.getConversation(activeConversationId),
          authApi.me(),
        ])

        if (cancelled) return

        const conv: Conversation = convRes.data as Conversation
        const me: ChatUser = meRes.data as ChatUser
        setCurrentUser(me)

        // Find the other participant
        const other = conv.participants.find((p) => p.userId !== me.id)?.user ?? null
        setOtherUser(other)

        // Load messages
        const msgsRes = await chatApi.getMessages(activeConversationId)
        if (cancelled) return

        const messages: ChatMessage[] = (msgsRes.data as { messages: ChatMessage[] }).messages ?? []

        setConversation({
          ...conv,
          _localMessages: messages,
          _hasMore: false,
          _loadingMore: false,
        })

        // Mark as read
        markActiveChatAsRead()

        // Join real-time room
        joinConversation(activeConversationId)
      } catch {
        if (!cancelled) setConversation(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      if (activeConversationId) {
        leaveConversation(activeConversationId)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId])

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = useCallback(
    (content: string) => {
      if (!conversation || !currentUser) return

      const clientId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const pendingMsg: PendingMessage = {
        clientId,
        conversationId: conversation.id,
        senderId: currentUser.id,
        sender: currentUser,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        status: 'pending',
      }

      // Optimistic update
      setConversation((prev) =>
        prev
          ? { ...prev, _localMessages: [...prev._localMessages, pendingMsg] }
          : prev
      )

      // Socket send - trim before sending to avoid server echoing untrimmed content
      sendMessage({
        conversationId: conversation.id,
        content: content.trim(),
        clientId,
      })
    },
    [conversation, currentUser, sendMessage]
  )

  // ── Typing ────────────────────────────────────────────────────────────────

  const handleTypingStart = useCallback(() => {
    if (!conversation) return
    startTyping(conversation.id)
  }, [conversation, startTyping])

  const handleTypingStop = useCallback(() => {
    if (!conversation) return
    stopTyping(conversation.id)
  }, [conversation, stopTyping])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <FABChatViewHeader
          otherUser={null}
          onBack={openPanel}
          onClose={closePanel}
        />
        <div className="flex-1 flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#71767b] animate-spin"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        </div>
      </div>
    )
  }

  if (!conversation || !currentUser) {
    return (
      <div className="flex flex-col h-full">
        <FABChatViewHeader
          otherUser={null}
          onBack={openPanel}
          onClose={closePanel}
        />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[#71767b]">Failed to load chat</p>
        </div>
      </div>
    )
  }

  const sortedMessages = [...conversation._localMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <FABChatViewHeader
        otherUser={otherUser}
        onBack={openPanel}
        onClose={closePanel}
      />

      {/* Message list */}
      <MessageList
        messages={sortedMessages}
        currentUserId={currentUser.id}
        showAvatar={false}
      />

      {/* Input */}
      <div className="border-t border-[#2f3336] p-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            placeholder="Message..."
            rows={1}
            className="
              flex-1 bg-[#2f3336] border border-[#2f3336]
              rounded-2xl px-4 py-2.5 text-white placeholder-[#71767b]
              resize-none focus:outline-none focus:border-[#1d9bf0]
              custom-scrollbar text-sm
            "
            style={{ maxHeight: '100px', overflowY: 'auto' }}
            onChange={(e) => {
              // typing indicator
              handleTypingStart()
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
              typingTimeoutRef.current = setTimeout(handleTypingStop, 2000)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                const text = inputRef.current?.value.trim() ?? ''
                if (!text) return
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                handleTypingStop()
                handleSend(text)
                inputRef.current!.value = ''
              }
            }}
          />
          <button
            onClick={() => {
              const text = inputRef.current?.value.trim() ?? ''
              if (!text) return
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
              handleTypingStop()
              handleSend(text)
              inputRef.current!.value = ''
            }}
            className="
              w-9 h-9 rounded-full flex items-center justify-center shrink-0
              bg-[#1d9bf0] text-white hover:opacity-90 transition-opacity
            "
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Inline header component ─────────────────────────────────────────────────

interface FABChatViewHeaderProps {
  otherUser: ChatUser | null
  onBack: () => void
  onClose: () => void
}

function FABChatViewHeader({ otherUser, onBack, onClose }: FABChatViewHeaderProps) {
  const avatarUrl = otherUser
    ? getAvatarUrl(otherUser.avatarUrl ?? null, otherUser.username)
    : null
  const displayName = otherUser?.displayName || otherUser?.username || 'Chat'
  const username = otherUser?.username

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#2f3336] shrink-0 bg-[#16181c]">
      {/* Back button */}
      <button
        onClick={onBack}
        className="p-1.5 rounded-full hover:bg-[#2f3336] transition-colors text-[#71767b] hover:text-white"
        aria-label="Back to chat list"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>

      {/* Avatar */}
      <div className="w-8 h-8 rounded-full overflow-hidden bg-[#2f3336] flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#71767b]">
            {displayName[0]?.toUpperCase() ?? '?'}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate leading-tight">{displayName}</p>
        {username && (
          <p className="text-xs text-[#71767b] truncate leading-tight">@{username}</p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="p-1.5 rounded-full hover:bg-[#2f3336] transition-colors text-[#71767b] hover:text-white"
        aria-label="Close chat panel"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    </div>
  )
}