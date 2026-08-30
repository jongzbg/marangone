import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Track which video rooms we've already joined (prevents duplicate emits
// when multiple PostCards all call useVideoReady for the same videoId)
const joinedRooms = new Set<string>();

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('token');
    socket = io('http://localhost:3001/video', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
    });
    socket.on('connect', () => {
      console.log('[Socket] Connected to /video namespace');
      // Clear joined rooms on reconnect — server will re-join us as needed
      joinedRooms.clear();
    });
    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from /video namespace');
    });
    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });
    socket.on('VIDEO_READY', (data) => {
      console.log('[Socket] VIDEO_READY received:', data.videoId, data.status);
    });
  }
  return socket;
}

/** Emit watch_video only once per videoId across all callers */
export function watchVideo(videoId: string) {
  const key = videoId;
  if (joinedRooms.has(key)) return;
  joinedRooms.add(key);
  getSocket().emit('watch_video', { videoId });
  console.log('[Socket] watch_video emitted for', videoId);
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  joinedRooms.clear();
}