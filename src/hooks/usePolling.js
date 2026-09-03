import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Polls an async fetcher on an interval. Used instead of the WebSocket
 * the original design called for on the dispatcher console - see the
 * note in this project's README on why, and what to swap in later.
 */
export function usePolling(fetcher, deps, intervalMs = 4000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
