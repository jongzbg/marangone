import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket, watchVideo } from '@/lib/socket';
import { videoApi } from '@/lib/api';

export interface VideoReadyPayload {
  videoId: string;
  status: 'ready' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  resolutions?: string[];
  encodingProfile?: string;
  error?: string;
}

export function useVideoReady(videoId: string | null) {
  const [videoData, setVideoData] = useState<VideoReadyPayload | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasNotifiedRef = useRef(false);
  // Track which video we've already subscribed to (prevents duplicate emits)
  const subscribedRef = useRef<string | null>(null);

  const stopAll = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!videoId) {
      setVideoData(null);
      stopAll();
      hasNotifiedRef.current = false;
      subscribedRef.current = null;
      return;
    }

    // Prevent duplicate subscriptions for the same videoId
    if (subscribedRef.current === videoId) return;
    subscribedRef.current = videoId;

    // Reset
    stopAll();
    hasNotifiedRef.current = false;
    setVideoData(null);

    const socket = getSocket();

    // ── Socket.IO (primary) ────────────────────────────────────────────────
    const handleVideoReady = (payload: VideoReadyPayload) => {
      if (payload.videoId !== videoId) return;
      if (hasNotifiedRef.current) return;
      hasNotifiedRef.current = true;
      setVideoData(payload);
      stopAll();
    };

    // Only emit watch_video once per videoId (watchVideo is deduped in socket.ts)
    watchVideo(videoId);
    socket.on('VIDEO_READY', handleVideoReady);

    // ── SSE fallback (only if Socket.IO fails) ────────────────────────────
    eventSourceRef.current = new EventSource(
      `http://localhost:3001/videos/${videoId}/stream`,
    );

    eventSourceRef.current.addEventListener('video_update', (e) => {
      if (hasNotifiedRef.current) return;
      const data = JSON.parse(e.data) as VideoReadyPayload;
      if (data.status === 'ready' || data.status === 'failed') {
        hasNotifiedRef.current = true;
        setVideoData(data);
        stopAll();
      }
    });

    eventSourceRef.current.onerror = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (hasNotifiedRef.current) return;
      let attempts = 0;
      pollIntervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const res = await videoApi.getVideoStatusById(videoId);
          const data = res.data;
          if (data?.status === 'ready' || data?.status === 'failed') {
            if (hasNotifiedRef.current) return;
            hasNotifiedRef.current = true;
            setVideoData(data);
            stopAll();
          }
          if (attempts >= 15) stopAll();
        } catch {
          // keep polling
        }
      }, 2000);
    };

    return () => {
      socket.off('VIDEO_READY', handleVideoReady);
      stopAll();
      // Only clear subscribedRef on unmount/cleanup, not on videoId change
    };
  }, [videoId, stopAll]);

  return videoData;
}