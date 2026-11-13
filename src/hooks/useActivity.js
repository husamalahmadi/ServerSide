import { useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiUrl } from "../config/env.js";

/** Logs a stock view, which also follows the stock for change emails in this language. */
export function useTrackView(ticker, lang) {
  const { user } = useAuth();
  const apiUrl = getApiUrl();
  const userId = user?.id;

  useEffect(() => {
    if (!ticker || !userId) return;
    fetch(`${apiUrl}/api/activity`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "view", ticker: ticker.toUpperCase(), lang }),
    }).catch(() => {});
  }, [userId, ticker, lang, apiUrl]);
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
