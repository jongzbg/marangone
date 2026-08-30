'use client'

import { useFABChat } from '@/hooks/useFABChat'
import FABConversationList from './FABConversationList'
import FABChatView from './FABChatView'

export default function FABWidget() {
  const { panelState, totalUnreadCount, openPanel, closePanel, isLoggedIn } = useFABChat()

  if (!isLoggedIn) return null

  return (
    <>
      {/* ── FAB Button ── */}
      {panelState === 'closed' && (
        <button
          onClick={openPanel}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#1d9bf0] text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-[9999]"
          aria-label="Open support chat"
        >
          {/* Mail icon */}
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          >
            chat
          </span>

          {/* Unread badge – top-right */}
          {totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#f01e25] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          )}
        </button>
      )}

      {/* ── Panel ── */}
      {panelState !== 'closed' && (
        <div
          className="
            fixed bottom-6 right-6 z-[9998]
            w-[380px] h-[520px] max-h-[70vh]
            bg-[#16181c] rounded-2xl border border-[#2f3336]
            shadow-2xl flex flex-col overflow-hidden
            sm:w-[calc(100vw-32px)] sm:max-w-[380px] sm:h-[70vh]
          "
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        >
          {/* Content – each child manages its own header */}
          <div className="flex-1 overflow-hidden">
            {panelState === 'list' && <FABConversationList />}
            {panelState === 'chat' && <FABChatView />}
          </div>
        </div>
      )}
    </>
  )
}