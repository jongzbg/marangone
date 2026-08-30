'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import { chatApi, authApi } from '@/lib/api'
import { useChatSocket } from '@/hooks/useChatSocket'
import type { Conversation, Message } from '@/types/chat'
import ConversationList from '@/components/chat/ConversationList'
import SkeletonLoader from '@/components/chat/SkeletonLoader'

export default function MessagesPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')

  // ── Fetch conversations ──────────────────────────────────────────────────────
  const fetchConversations = useCallback(() => {
    chatApi.getConversations()
      .then(res => setConversations(res.data?.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }

    authApi.me().then(res => setCurrentUserId(res.data.id)).catch(() => {})

    fetchConversations()
  }, [router, fetchConversations])

  // ── Real-time: update conversation list when new messages arrive ──────────────
  // Handles messages sent from FAB, other sessions, or other users.
  // A custom event 'fab_message_sent' is dispatched by FAB when the user sends
  // a message from the FAB panel — it carries the conversationId so we can
  // update the right conversation's lastMessage field.

  const handleNewMessage = useCallback((message: Message) => {
    if (!message.conversationId) return
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === message.conversationId)
      if (idx === -1) return prev
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        lastMessage: message,
        lastMessageAt: message.createdAt,
        // If message is from someone else (not current user), increment unread
        unreadCount: (updated[idx].unreadCount ?? 0),
      }
      // Re-sort so most-recently-active conversation is at top
      updated.sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
        return tb - ta
      })
      return updated
    })
  }, [])

  useChatSocket({ onNewMessage: handleNewMessage })

  // Listen for FAB-initiated sends (no socket listener in messages page by default)
  useEffect(() => {
    function onFABMessageSent(e: Event) {
      const { conversationId, message } = (e as CustomEvent<{ conversationId: string; message: Message }>).detail
      if (!conversationId || !message) return
      handleNewMessage(message)
    }
    window.addEventListener('fab_message_sent', onFABMessageSent)
    return () => window.removeEventListener('fab_message_sent', onFABMessageSent)
  }, [handleNewMessage])

  // ── Handle click ─────────────────────────────────────────────────────────────
  const handleConversationClick = (convId: string) => {
    // Dispatch read event so header badge clears
    window.dispatchEvent(new CustomEvent('messages_read', { detail: { conversationId: convId } }))
    router.push(`/messages/${convId}`)
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto">
        {/* Sticky header */}
        <div className="sticky top-16 z-40 bg-black/80 backdrop-blur-md px-4 h-14 flex items-center border-b border-border">
          <h1 className="font-headline-md text-text-primary">Messages</h1>
        </div>

        {loading ? (
          <SkeletonLoader />
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            <p className="text-body-lg mb-2">No conversations yet</p>
            <p className="text-body-sm">Start chatting from someone&apos;s profile!</p>
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            currentUserId={currentUserId}
            onSelect={handleConversationClick}
          />
        )}
      </div>
    </MainLayout>
  )
}
