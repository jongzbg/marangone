'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface HoverCardData {
  userId: string
  username: string
  avatar: string
  name: string
  bio: string
  following: number
  followers: number
  likes: number
  likesToday?: number
  isFollowing?: boolean
  // Position of trigger element
  rect: DOMRect
  // Which side to align (left edge of card)
  left: number
  // Which side to show (above or below trigger)
  placement: 'top' | 'bottom'
}

interface UseHoverCardOptions {
  /** ms delay before showing */
  openDelay?: number
  /** ms delay before hiding */
  closeDelay?: number
}

interface HoverCardState {
  visible: boolean
  data: HoverCardData | null
  currentUserId: string | null
}

export function useHoverCard(options: UseHoverCardOptions = {}) {
  const { openDelay = 300, closeDelay = 200 } = options
  const [state, setState] = useState<HoverCardState>({ visible: false, data: null, currentUserId: null })
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoveredUsername = useRef<string | null>(null)

  const clearTimers = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    showTimer.current = null
    hideTimer.current = null
  }, [])

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const cancelShow = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }
  }, [])

  // Called by PostCard / banner — opens card
  const onHoverEnter = useCallback((username: string, rect: DOMRect, left: number, placement: 'top' | 'bottom') => {
    cancelHide()
    if (hoveredUsername.current === username && state.visible) return
    hoveredUsername.current = username
    showTimer.current = setTimeout(() => {
      setState((prev) => ({ ...prev, visible: true, data: { userId: '', username, avatar: '', name: '', bio: '', following: 0, followers: 0, likes: 0, likesToday: 0, rect, left, placement } }))
    }, openDelay)
  }, [cancelHide, state.visible, openDelay])

  // Called when user leaves the trigger element
  const onHoverLeave = useCallback(() => {
    cancelShow()
    hoveredUsername.current = null
    hideTimer.current = setTimeout(() => {
      setState((prev) => ({ ...prev, visible: false, data: null }))
    }, closeDelay)
  }, [cancelShow, closeDelay])

  // Called when user moves mouse from trigger INTO the hover card itself
  const onCardEnter = useCallback(() => {
    cancelHide()
  }, [cancelHide])

  // Called when user leaves the hover card itself
  const onCardLeave = useCallback(() => {
    hoveredUsername.current = null
    hideTimer.current = setTimeout(() => {
      setState((prev) => ({ ...prev, visible: false, data: null }))
    }, closeDelay)
  }, [closeDelay])

  // Update with full user data (called after API returns)
  const setCardData = useCallback((data: Omit<HoverCardData, 'rect' | 'left' | 'placement'> & { rect?: DOMRect; left?: number; placement?: 'top' | 'bottom' }) => {
    setState((prev) => {
      if (!prev.data || prev.data.username !== data.username) return prev
      return {
        ...prev,
        data: {
          ...prev.data,
          userId: data.userId,
          avatar: data.avatar,
          name: data.name,
          bio: data.bio,
          following: data.following,
          followers: data.followers,
          likes: data.likes,
          likesToday: data.likesToday,
          isFollowing: data.isFollowing,
        },
      }
    })
  }, [])

  // Update current user ID (for "is own profile" check)
  const setCurrentUserId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, currentUserId: id }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  return {
    visible: state.visible,
    data: state.data,
    currentUserId: state.currentUserId,
    onHoverEnter,
    onHoverLeave,
    onCardEnter,
    onCardLeave,
    setCardData,
    setCurrentUserId,
  }
}
