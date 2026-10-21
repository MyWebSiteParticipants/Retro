import { useCallback, useEffect, useRef, useState } from "react";

export interface Polled<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** Re-fetch now (e.g. right after a mutation). */
  refresh: () => Promise<void>;
}

/**
 * Fetch `fn` now and again every `ms` while the tab is visible. The board uses
 * this instead of websockets: GitHub is the only source of truth, and a
 * 6-person team polling every few seconds is far inside the API rate limit
 * (5,000 points/hour per user; one board read costs 1).
 */
export function usePolling<T>(fn: () => Promise<T>, ms: number, deps: unknown[]): Polled<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const d = await fnRef.current();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, refresh, ...deps]);

  return { data, error, loading, refresh };
}
