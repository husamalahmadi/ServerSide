import React, { createContext, useContext, useEffect, useState } from "react";
import { getApiUrl, hasExplicitViteApiUrl } from "../config/env.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = getApiUrl();
    fetch(`${apiUrl}/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user || null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = () => {
    // Static hosts (Cloudflare Pages, Vercel) do not run Express. Without VITE_API_URL,
    // getApiUrl() is the same origin — /auth/google would load the SPA with no route → blank page.
    if (import.meta.env.PROD && !hasExplicitViteApiUrl()) {
      window.location.assign("/?auth=api_required");
      return;
    }
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
