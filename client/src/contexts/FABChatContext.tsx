'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { chatApi } from '@/lib/chatApi'
import { useChat } from '@/hooks/useChat'
import type { FABPanelState } from '@/types/fab'
import type { Message, Conversation } from '@/types/chat'

// ─── Context Shape ─────────────────────────────────────────────────────────

interface FABChatContextValue {
  panelState: FABPanelState
  activeConversationId: string | null
  totalUnreadCount: number
  isLoggedIn: boolean
  openPanel: () => void
  openChat: (conversationId: string) => void
  closePanel: () => void
  setUnreadCount: (count: number) => void
  markActiveChatAsRead: () => void
  logout: () => void
}

export const FABChatContext = createContext<FABChatContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

interface FABChatProviderProps {
  children: ReactNode
}

export function FABChatProvider({ children }: FABChatProviderProps) {
  const [panelState, setPanelState] = useState<FABPanelState>('closed')
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Track which conversation is currently visible in the panel
  // so we don't double-count messages in the active chat.
  const activeConversationIdRef = useRef<string | null>(null)

  // Guard against processing the same message twice (e.g., socket reconnect)
  const processedMessageIdsRef = useRef(new Set<string>())

  // ── Detect login state from token ───────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) setIsLoggedIn(true)
  }, [])

  // ── onMessage callback (stable ref so useChat captures latest) ─────────────
  // We store the handler in a ref so that useChat's useEffect (deps=[]) always
  // calls the current version — not the one captured at mount time.

  const onMessageRef = useRef<(message: Message, conversationId: string) => void>()

  onMessageRef.current = (message: Message, _conversationId: string) => {
    if ('id' in message && message.id && processedMessageIdsRef.current.has(message.id)) return
    if ('id' in message && message.id) processedMessageIdsRef.current.add(message.id)
    if (message.conversationId !== activeConversationIdRef.current) {
      setTotalUnreadCount((prev) => prev + 1)
    }
  }

  // Real-time: increment unread count for messages NOT in the active chat.
  useChat({
    onMessage: (message, conversationId) => onMessageRef.current?.(message, conversationId),
  })

  // Sync the ref whenever activeConversationId changes
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  // ── Fetch conversations on mount to compute initial unread count ────────────

  useEffect(() => {
    if (!isLoggedIn) return
    let cancelled = false

    chatApi.getConversations().then(({ data }) => {
      if (cancelled) return
      const rawConvs = (data as any)?.conversations || []
      const total = (rawConvs as { unreadCount?: number }[]).reduce<number>((acc: number, c) => acc + (c.unreadCount ?? 0), 0)
      setTotalUnreadCount(total)
    }).catch(() => {
      if (!cancelled) setTotalUnreadCount(0)
    })

    return () => { cancelled = true }
  }, [isLoggedIn])

  // ── Listen to messages_read CustomEvent ───────────────────────────────────
  // Refetch unread count from API when messages are read, to stay in sync
  // with the Header (which also refetches on messages_read).

  useEffect(() => {
    function onMessagesRead() {
      chatApi.getConversations().then(({ data }) => {
        const conversations = (data as { conversations: Conversation[] })?.conversations || []
        const total = conversations.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0)
        setTotalUnreadCount(total)
      }).catch(() => {})
    }

    window.addEventListener('messages_read', onMessagesRead)
    return () => window.removeEventListener('messages_read', onMessagesRead)
  }, [])

  // ── Listen for logout event from Header ────────────────────────────────────
  // Resets all FAB state when user logs out.

  useEffect(() => {
    function onLogout() {
      activeConversationIdRef.current = null
      setActiveConversationId(null)
      setPanelState('closed')
      setTotalUnreadCount(0)
      setIsLoggedIn(false)
    }
    window.addEventListener('nexus:logout', onLogout)
    return () => window.removeEventListener('nexus:logout', onLogout)
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────

  const openPanel = useCallback(() => {
    setPanelState('list')
  }, [])

  const openChat = useCallback((conversationId: string) => {
    activeConversationIdRef.current = conversationId
    setActiveConversationId(conversationId)
    setPanelState('chat')
  }, [])

  const closePanel = useCallback(() => {
    activeConversationIdRef.current = null
    setActiveConversationId(null)
    setPanelState('closed')
  }, [])

  const setUnreadCount = useCallback((count: number) => {
    setTotalUnreadCount(count)
  }, [])

  const markActiveChatAsRead = useCallback(async () => {
    const convId = activeConversationIdRef.current
    if (!convId) return
    try {
      await chatApi.markAsRead(convId)
      setTotalUnreadCount((prev) => Math.max(0, prev - 1))
      // Notify other listeners (Header, etc.) that this conversation was read
      window.dispatchEvent(new CustomEvent('messages_read', {
        detail: { conversationId: convId, fromFAB: true },
      }))
    } catch {
      // non-critical
    }
  }, [])

  const logout = useCallback(() => {
    activeConversationIdRef.current = null
    setActiveConversationId(null)
    setPanelState('closed')
    setTotalUnreadCount(0)
    setIsLoggedIn(false)
  }, [])

  // ── Context value ──────────────────────────────────────────────────────────

  const value: FABChatContextValue = {
    panelState,
    activeConversationId,
    totalUnreadCount,
    isLoggedIn,
    openPanel,
    openChat,
    closePanel,
    setUnreadCount,
    markActiveChatAsRead,
    logout,
  }

  return (
    <FABChatContext.Provider value={value}>
      {children}
    </FABChatContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useFABChat – thin wrapper around FABChatContext.
 * Must be used inside <FABChatProvider>.
 */
export function useFABChat(): FABChatContextValue {
  const ctx = useContext(FABChatContext)
  if (!ctx) {
    throw new Error('useFABChat must be used inside <FABChatProvider>')
  }
  return ctx
}

export default FABChatProvider