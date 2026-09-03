import { useEffect, useRef, useState } from 'react';
import { getAuthToken } from '../api.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// http(s) -> ws(s), same host/port as the REST API.
function wsUrl(eventId) {
  const url = new URL(BASE_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/events/${eventId}/live`;
  url.searchParams.set('token', getAuthToken() ?? '');
  return url.toString();
}

/**
 * Opens a WebSocket to the event's live channel and calls onMessage for
 * every "something changed" signal the server sends (see backend's
 * liveUpdates.js - it's a lightweight refetch trigger, not a payload
 * push). Auto-reconnects with a short fixed backoff on close/error,
 * since a dropped connection here shouldn't require a page reload to
 * recover from.
 *
 * This intentionally doesn't replace polling - see usePolling call
 * sites in Dashboard.jsx, which keep running underneath this at a
 * lengthened interval as a resilience backstop. If the socket is
 * healthy, the poll's refresh is just redundant with what the socket
 * already triggered; if the socket silently died, the poll is what
 * keeps data from going stale indefinitely.
 */
export function useLiveSocket(eventId, onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    let socket;
    let reconnectTimer;
    let stopped = false;

    function connect() {
      socket = new WebSocket(wsUrl(eventId));

      socket.onopen = () => setConnected(true);

      socket.onmessage = () => {
        onMessageRef.current?.();
      };

      socket.onclose = () => {
        setConnected(false);
        if (!stopped) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [eventId]);

  return connected;
}
