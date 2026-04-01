import { useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiUrl } from "../config/env.js";

export function useTrackView(ticker) {
  const { user } = useAuth();
  const apiUrl = getApiUrl();

  useEffect(() => {
    if (!ticker || !user) return;
    fetch(`${apiUrl}/api/activity`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "view", ticker: ticker.toUpperCase() }),
    }).catch(() => {});
  }, [user, ticker, apiUrl]);
}

export function useActivity() {
  const { user } = useAuth();
  const apiUrl = getApiUrl();

  const logActivity = useCallback(
    async (type, ticker, metadata) => {
      if (!user) return;
      try {
        await fetch(`${apiUrl}/api/activity`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, ticker: ticker?.toUpperCase(), metadata }),
        });
      } catch (e) {
        console.warn("Activity log failed:", e);
      }
    },
    [user, apiUrl]
  );

  return { logActivity };
}
