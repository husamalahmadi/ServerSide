import React from "react";
import { Link, useLocation } from "react-router-dom";
import { getApiUrl } from "../config/env.js";

/**
 * Fallback when the SPA renders /auth/* (e.g. client-side nav). Full-page visit to /auth/google
 * should be handled by Express first (see server middleware order).
 */
export default function AuthSignInHelp() {
  const location = useLocation();
  const apiBase = getApiUrl();
  const oauthStart = `${apiBase.replace(/\/+$/, "")}/auth/google`;

  return (
    <div
      dir="ltr"
      style={{
        padding: 24,
        maxWidth: 560,
        margin: "48px auto",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.65,
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Continue Google sign-in</h1>
      <p style={{ color: "#444", marginBottom: 16 }}>
        The app opened <code style={{ fontSize: 13 }}>{location.pathname}</code> inside the React shell. Use the button
        below to open the server sign-in URL, or go home and click <strong>Sign in with Google</strong> again (full page
        navigation).
      </p>
      <p style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => {
            window.location.href = oauthStart;
          }}
          style={{
            padding: "10px 16px",
            fontSize: 14,
            cursor: "pointer",
            borderRadius: 8,
            border: "1px solid #1a3a2a",
            background: "#1a3a2a",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          Continue to Google ({apiBase})
        </button>
      </p>
      <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
        <Link to="/" style={{ color: "var(--tp-accent, #1a3a2a)", fontWeight: 600 }}>
          ← Home
        </Link>
      </p>
    </div>
  );
}
