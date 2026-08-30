'use client'

import { useCallback, useRef } from 'react'
import { useUserHoverCard } from '@/contexts/UserHoverCardContext'

interface UserHoverTriggerProps {
  /** Username ของ user ที่จะแสดง hover card */
  username: string
  /** Avatar URL — pass from PostCard post.user */
  avatar: string
  /** Children คือ element ที่จะ trigger hover (avatar, name, username) */
  children: React.ReactNode
  /** className ที่จะ apply ให้ wrapper */
  className?: string
}

/**
 * Wrap any element (avatar, name, username) with this to show a hover card.
 * Hover card appears on mouse enter after 300ms delay, hides after 200ms delay.
 * The card itself keeps it open when hovered.
 */
export default function UserHoverTrigger({ username, avatar, children, className }: UserHoverTriggerProps) {
  const { show, hide, visible, triggerData, cancelHideFor } = useUserHoverCard()
  const isAlreadyOpen = useRef(false)

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const left = rect.left
    const placement = window.innerHeight - rect.bottom < 220 ? 'top' : 'bottom'

    // Don't re-show if already showing this same user
    if (visible && triggerData?.username === username) {
      // Cancel pending hide if mouse re-enters before timer fires
      cancelHideFor(username)
      return
    }

    isAlreadyOpen.current = false
    show({ username, avatar, rect, left, placement })
  }, [visible, triggerData, username, avatar, show, cancelHideFor])

  const handleMouseLeave = useCallback(() => {
    hide()
  }, [hide])

  return (
    <div
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  )
}
