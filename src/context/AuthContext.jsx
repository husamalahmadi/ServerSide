import React, { createContext, useContext, useEffect, useState } from "react";
import { getApiUrl } from "../config/env.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = getApiUrl();

    async function fetchMe() {
      const r = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
      return r.json();
    }

    // Split deploy (e.g. Cloudflare + Render): after OAuth redirect, cookie may not be sent on
    // the first fetch yet; API may also be cold-starting. Retry until we get a user or give up.
    let cancelled = false;
    const delaysMs = [0, 400, 1200, 2500];

    async function run() {
      for (let i = 0; i < delaysMs.length; i++) {
        if (cancelled) return;
        if (delaysMs[i] > 0) {
          await new Promise((r) => setTimeout(r, delaysMs[i]));
        }
        if (cancelled) return;
        try {
          const data = await fetchMe();
          if (cancelled) return;
          if (data.user) {
            setUser(data.user);
            setLoading(false);
            return;
          }
          // user null — keep retrying (session may appear on next attempt)
        } catch {
          /* network error — keep retrying */
        }
      }
      if (!cancelled) {
        setUser(null);
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = () => {
    // Always send the browser to the API OAuth route. Do not block on heuristics (Vite env
    // flags and same-origin checks vary by host and have caused false "api_required" redirects).
    // Split frontend/API: set VITE_API_URL or public/runtime-config.js so getApiUrl() targets the API.
    window.location.href = `${getApiUrl()}/auth/google`;
  };

  const logout = async () => {
    try {
      await fetch(`${getApiUrl()}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const r = await fetch(`${getApiUrl()}/auth/me`, { credentials: "include" });
      const data = await r.json();
      setUser(data.user || null);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  };

  const value = { user, loading, login, logout, refreshUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
