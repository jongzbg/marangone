'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { API_BASE_URL } from '@/lib/api'

interface UseChatSocketOptions {
  onNewMessage?: (message: any) => void
  onMessageError?: (data: any) => void
  onUserTyping?: (data: { conversationId: string; userId: string; username: string }) => void
  onUserStoppedTyping?: (data: { conversationId: string; userId: string }) => void
}

export function useChatSocket(options: UseChatSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const socket = io(`${API_BASE_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      setIsConnected(true)
      console.log('[ChatSocket] Connected:', socket.id)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      console.log('[ChatSocket] Disconnected')
    })

    socket.on('error', (data: { message: string }) => {
      console.error('[ChatSocket] Error:', data.message)
    })

    socket.on('new_message', (message: any) => {
      options.onNewMessage?.(message)
    })

    socket.on('message_error', (data: any) => {
      options.onMessageError?.(data)
    })

    socket.on('user_typing', (data: any) => {
      options.onUserTyping?.(data)
    })

    socket.on('user_stopped_typing', (data: any) => {
      options.onUserStoppedTyping?.(data)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('join_conversation', { conversationId })
  }, [])

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('leave_conversation', { conversationId })
  }, [])

  const sendMessage = useCallback((data: {
    conversationId: string
    content?: string
    mediaUrl?: string
    clientId?: string
  }) => {
    socketRef.current?.emit('send_message', data)
  }, [])

  const startTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing_start', { conversationId })
  }, [])

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing_stop', { conversationId })
  }, [])

  return {
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
  }
}