'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Socket } from 'socket.io-client'
import { getSocket, disconnectSocket } from '@/lib/socket'

/**
 * useSocket – manages the singleton Socket.IO connection lifecycle.
 *
 * Returns:
 *  - socket  : the active Socket instance (null when not yet connected)
 *  - isConnected : boolean connection state
 *  - isConnecting: true while the handshake is in flight
 *
 * It is safe to call this hook from multiple components – they all share the
 * same underlying socket instance.
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const socket = getSocket()
    socketRef.current = socket

    if (socket.connected) {
      setIsConnected(true)
      setIsConnecting(false)
    } else {
      setIsConnecting(true)
    }

    function onConnect() {
      setIsConnected(true)
      setIsConnecting(false)
    }

    function onDisconnect() {
      setIsConnected(false)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  /**
   * Manually trigger a reconnection attempt.
   * Useful after the token has been refreshed.
   */
  const reconnect = useCallback(() => {
    const socket = socketRef.current
    if (socket && !socket.connected) {
      socket.connect()
    }
  }, [])

  /**
   * Manually disconnect.  Subsequent useSocket callers will receive a new
   * socket instance on next call.
   */
  const disconnect = useCallback(() => {
    disconnectSocket()
    socketRef.current = null
    setIsConnected(false)
    setIsConnecting(false)
  }, [])

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    reconnect,
    disconnect,
  }
}
