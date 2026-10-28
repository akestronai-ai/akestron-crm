"use client";

import { useEffect, useEffectEvent } from "react";

// Refresh shared PostgreSQL data on focus/reconnection and every ten seconds
// while the tab is visible.
export function useSyncRefresh(refresh: () => Promise<void>) {
  const run = useEffectEvent(refresh);
  useEffect(() => {
    let running = false;
    const sync = async () => {
      if (document.visibilityState !== "visible" || running || !navigator.onLine) return;
      running = true;
      try { await run(); } finally { running = false; }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 10000);
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
}
