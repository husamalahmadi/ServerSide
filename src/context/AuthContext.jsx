import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getApiUrl } from "../config/env.js";

const AuthContext = createContext(null);

async function fetchMeJson(apiUrl) {
  const r = await fetch(`${apiUrl}/auth/me`, { credentials: "include", cache: "no-store" });
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error("non-json response");
  }
  return r.json();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  const pathnameRef = useRef(location.pathname);
  const lastExtraFetchRef = useRef(0);
  navigateRef.current = navigate;
  pathnameRef.current = location.pathname;

  const stripTpSessionParam = useCallback(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (!sp.get("tp_session")) return;
      sp.delete("tp_session");
      const q = sp.toString();
      const path = pathnameRef.current;
      navigateRef.current(`${path}${q ? `?${q}` : ""}`, { replace: true });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const apiUrl = getApiUrl();
    let cancelled = false;

    const isFreshOAuth = new URLSearchParams(window.location.search).get("tp_session") === "1";
    const delaysMs = isFreshOAuth
      ? [0, 200, 500, 1000, 2000, 3500, 5000, 7500, 10000, 13000]
      : [0, 300, 800, 1600, 3200, 5000];

    async function run() {
      for (let i = 0; i < delaysMs.length; i++) {
        if (cancelled) return;
        if (delaysMs[i] > 0) {
          await new Promise((r) => setTimeout(r, delaysMs[i]));
        }
        if (cancelled) return;
        try {
          const data = await fetchMeJson(apiUrl);
          if (cancelled) return;
          if (data.user) {
            setUser(data.user);
            setLoading(false);
            stripTpSessionParam();
            return;
          }
        } catch {
          /* session not ready yet — retry */
        }
      }
      if (!cancelled) {
        setUser(null);
        setLoading(false);
        stripTpSessionParam();
      }
    }

    run();

    const throttledExtra = () => {
      if (cancelled) return;
      const now = Date.now();
      if (now - lastExtraFetchRef.current < 2500) return;
      lastExtraFetchRef.current = now;
      fetchMeJson(apiUrl)
        .then((data) => {
          if (cancelled || !data.user) return;
          setUser(data.user);
          setLoading(false);
          stripTpSessionParam();
        })
        .catch(() => {});
    };

    const onFocus = () => throttledExtra();
    const onVis = () => {
      if (document.visibilityState === "visible") throttledExtra();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [stripTpSessionParam]);

  const login = () => {
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
      const data = await fetchMeJson(getApiUrl());
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
