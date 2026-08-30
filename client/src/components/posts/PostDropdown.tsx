'use client'

import { useState, useRef, useEffect } from 'react'

interface PostDropdownProps {
  postId: string
  isPinned: boolean
  showPinButton?: boolean
  onDelete: (postId: string) => void
  onPin: (postId: string) => void
  onUnpin: (postId: string) => void
  onClose: () => void
}

export default function PostDropdown({
  postId,
  isPinned,
  showPinButton = false,
  onDelete,
  onPin,
  onUnpin,
  onClose,
}: PostDropdownProps) {
  const [confirmAction, setConfirmAction] = useState<'delete' | 'pin' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleDelete = () => {
    setConfirmAction('delete')
  }

  const handlePin = () => {
    setConfirmAction('pin')
  }

  const handleConfirm = () => {
    if (confirmAction === 'delete') {
      onDelete(postId)
    } else if (confirmAction === 'pin') {
      if (isPinned) {
        onUnpin(postId)
      } else {
        onPin(postId)
      }
    }
    onClose()
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 w-72 bg-[#200D21] border border-[#3F3F3F] rounded-xl shadow-2xl z-50 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {confirmAction === 'delete' ? (
        <div className="p-4">
          <p className="text-text-primary font-bold text-base mb-1">ลบโพสต์?</p>
          <p className="text-text-muted text-sm mb-4">โพสต์นี้จะถูกลบถาวร และไม่สามารถกู้คืนได้</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmAction(null)}
              className="flex-1 px-4 py-2 rounded-full border border-[#3F3F3F] text-text-primary text-sm font-bold hover:bg-[#3F3F3F]/50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"
            >
              ลบ
            </button>
          </div>
        </div>
      ) : confirmAction === 'pin' ? (
        <div className="p-4">
          <p className="text-text-primary font-bold text-base mb-1">
            {isPinned ? 'เลิกปักหมุด?' : 'ปักหมุดโพสต์?'}
          </p>
          <p className="text-text-muted text-sm mb-4">
            {isPinned
              ? 'โพสต์นี้จะถูกเลิกปักหมุดจากด้านบนของโปรไฟล์'
              : 'โพสต์นี้จะถูกปักไว้ที่ด้านบนของโปรไฟล์'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmAction(null)}
              className="flex-1 px-4 py-2 rounded-full border border-[#3F3F3F] text-text-primary text-sm font-bold hover:bg-[#3F3F3F]/50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 rounded-full bg-[#1D9BF0] text-white text-sm font-bold hover:bg-[#1A8CD8] transition-colors"
            >
              {isPinned ? 'เลิกปักหมุด' : 'ปักหมุด'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#3F3F3F]/30 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-red-500">delete</span>
            <span className="text-text-primary font-medium">ลบ</span>
          </button>
          {showPinButton && (
            <button
              onClick={handlePin}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#3F3F3F]/30 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-[#1D9BF0]">push_pin</span>
              <span className="text-text-primary font-medium">
                {isPinned ? 'เลิกปักหมุด' : 'ปักหมุด'}
              </span>
            </button>
          )}
        </>
      )}
    </div>
  )
}
