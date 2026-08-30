'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

interface HoverTriggerData {
  username: string
  avatar: string
  rect: DOMRect
  left: number
  placement: 'top' | 'bottom'
}

interface UserHoverCardContextValue {
  // Show hover card
  show: (data: HoverTriggerData) => void
  // Hide hover card
  hide: () => void
  // Update card content with full profile data
  updateData: (data: HoverCardUserData) => void
  // Set logged-in username
  setCurrentUsername: (username: string | null) => void
  // Current state
  visible: boolean
  triggerData: HoverTriggerData | null
  userData: HoverCardUserData | null
  currentUsername: string | null
  /** เรียกจาก card เมื่อ card mount — ป้องกัน hideTimer ที่ยังทำงานอยู่ */
  cardMounted: (username: string) => void
  /** ยกเลิก hide timer */
  cancelHide: () => void
  /** ยกเลิก hide timer เฉพาะ username นี้ */
  cancelHideFor: (username: string) => void
}

export interface HoverCardUserData {
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
}

const UserHoverCardContext = createContext<UserHoverCardContextValue | null>(null)

export function UserHoverCardProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [triggerData, setTriggerData] = useState<HoverTriggerData | null>(null)
  const [userData, setUserData] = useState<HoverCardUserData | null>(null)
  const [currentUsername, setCurrentUsername] = useState<string | null>(null)

  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Username ที่กำลัง pending show (set ทันทีเมื่อเรียก show() — ก่อน timer fire) */
  const pendingUsername = useRef<string | null>(null)

  const clearTimers = useCallback(() => {
    if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null }
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
  }, [])

  const show = useCallback((data: HoverTriggerData) => {
    clearTimers()
    pendingUsername.current = data.username
    showTimer.current = setTimeout(() => {
      setTriggerData(data)
      setUserData(null)
      setVisible(true)
      pendingUsername.current = null
    }, 300)
  }, [clearTimers])

  const hide = useCallback(() => {
    clearTimers()
    pendingUsername.current = null
    hideTimer.current = setTimeout(() => {
      setVisible(false)
      setTriggerData(null)
      setUserData(null)
    }, 200)
  }, [clearTimers])

  /**
   * เรียกจาก card เมื่อ card mount (onMouseEnter บน card element)
   * ป้องกัน hideTimer ที่เริ่มระหว่าง mouse ออกจาก trigger แต่ card ยังไม่ทัน mount
   */
  const cardMounted = useCallback((username: string) => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const cancelHide = useCallback(() => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
  }, [])

  /**
   * เรียกจาก trigger เมื่อ mouse re-enter trigger
   * ป้องกัน hide ที่เกิดจากการเลื่อนเร็ว (mouse ออก trigger แล้วเข้าใหม่ก่อน hide ทำงาน)
   */
  const cancelHideFor = useCallback((username: string) => {
    // Cancel hide if: hideTimer is pending AND (it's the same user OR show is still pending for this user)
    if (hideTimer.current && pendingUsername.current === username) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const updateData = useCallback((data: HoverCardUserData) => {
    setUserData(data)
  }, [])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  return (
    <UserHoverCardContext.Provider value={{ visible, triggerData, userData, currentUsername, show, hide, updateData, setCurrentUsername, cardMounted, cancelHide, cancelHideFor }}>
      {children}
    </UserHoverCardContext.Provider>
  )
}

export function useUserHoverCard() {
  const ctx = useContext(UserHoverCardContext)
  if (!ctx) throw new Error('useUserHoverCard must be used inside UserHoverCardProvider')
  return ctx
}
