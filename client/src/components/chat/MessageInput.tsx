'use client'

import { useRef, useCallback, useState, KeyboardEvent, ChangeEvent } from 'react'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MessageInputProps {
  onSend: (content: string) => void
  onTypingStart?: () => void
  onTypingStop?: () => void
  disabled?: boolean
}

// ─── Send icon (inline SVG) ───────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  )
}

// ─── MessageInput ─────────────────────────────────────────────────────────────

export default function MessageInput({
  onSend,
  onTypingStart,
  onTypingStop,
  disabled = false,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [inputValue, setInputValue] = useState('')

  // ── Auto-grow textarea ─────────────────────────────────────────────────────

  function autoGrow() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // ── Typing events ──────────────────────────────────────────────────────────

  function handleTypingStart() {
    if (!onTypingStart || !onTypingStop) return
    onTypingStart()

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop()
    }, 3000)
  }

  function handleTypingStop() {
    if (!onTypingStop) return
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    onTypingStop()
  }

  // ── Change handler ─────────────────────────────────────────────────────────

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      autoGrow()
      setInputValue(e.target.value)

      if (!onTypingStart || !onTypingStop) return

      if (e.target.value.trim()) {
        handleTypingStart()
      } else {
        handleTypingStop()
      }
    },
    [onTypingStart, onTypingStop]
  )

  // ── Blur handler ────────────────────────────────────────────────────────────

  const handleBlur = useCallback(() => {
    handleTypingStop()
  }, [onTypingStop])

  // ── Send ───────────────────────────────────────────────────────────────────

  function send() {
    const text = textareaRef.current?.value.trim()
    if (!text || disabled) return

    handleTypingStop()
    onSend(text)

    // Reset textarea
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }
    setInputValue('')
  }

  // ── Key handler ────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.stopPropagation()
        e.preventDefault()
        send()
      }
    },
    [disabled]
  )

  const isEmpty = !inputValue.trim()

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex items-end gap-2 max-w-2xl mx-auto">
      <textarea
        ref={textareaRef}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Message..."
        disabled={disabled}
        rows={1}
        className="
          flex-1 bg-[#2f3336] border border-[#2f3336]
          rounded-2xl px-4 py-2.5 text-white placeholder-[#71767b]
          resize-none focus:outline-none focus:border-[#1d9bf0] focus:ring-0
          custom-scrollbar text-sm
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        style={{ minHeight: '40px', maxHeight: '120px', overflowY: 'auto' }}
      />
      <button
        onClick={send}
        disabled={isEmpty || disabled}
        className="
          w-10 h-10 rounded-full flex items-center justify-center
          shrink-0 transition-colors
          disabled:cursor-not-allowed
          text-white
          hover:opacity-90
          disabled:opacity-30 disabled:hover:opacity-30
          bg-[#1d9bf0]
        "
        style={isEmpty || disabled ? { backgroundColor: '#3f3f46' } : {}}
        aria-label="Send message"
      >
        <SendIcon />
      </button>
    </div>
  )
}
