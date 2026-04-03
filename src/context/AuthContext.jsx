import React, { createContext, useContext, useEffect, useState } from "react";
import { getApiUrl } from "../config/env.js";

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
