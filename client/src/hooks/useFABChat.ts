'use client'

import { useContext } from 'react'
import { FABChatContext } from '@/contexts/FABChatContext'

/**
 * useFABChat – simple useContext wrapper around FABChatContext.
 * Must be used inside <FABChatProvider>.
 *
 * Returns:
 *  - panelState: 'closed' | 'list' | 'chat'
 *  - activeConversationId: string | null
 *  - totalUnreadCount: number
 *  - openPanel(): open the conversation list panel
 *  - openChat(id): switch panel to chat view for the given conversation
 *  - closePanel(): fully close the FAB panel
 *  - setUnreadCount(count): override the computed unread badge count
 *  - markActiveChatAsRead(): POST /conversations/:id/read for the active chat
 */
export function useFABChat() {
  const ctx = useContext(FABChatContext)
  if (!ctx) {
    throw new Error('useFABChat must be used inside <FABChatProvider>')
  }
  return ctx
}