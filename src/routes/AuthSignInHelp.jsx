import React from "react";
import { Link, useLocation } from "react-router-dom";
import { getApiUrl } from "../config/env.js";

/**
 * Shown when the SPA handles /auth/* (e.g. static fallback) instead of Express OAuth.
 * Copy is host-neutral (Render, Cloudflare, Vercel, etc.).
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
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Sign-in needs the API server</h1>
      <p style={{ color: "#444", marginBottom: 12 }}>
        You opened <code style={{ fontSize: 13 }}>{location.pathname}</code> in the React app. Google sign-in is
        implemented in the Express app under <code style={{ fontSize: 13 }}>server/</code>, not in this static
        bundle. If you see this page after clicking &quot;Sign in with Google&quot;, the browser did not reach the
        API — often because only the frontend was deployed, or the host serves <code>index.html</code> for every
        path before Node can handle <code>/auth/google</code>.
      </p>
      <p style={{ color: "#444", marginBottom: 12 }}>
        <strong>One Render service (recommended):</strong> deploy the repo with a start command that runs{" "}
        <code style={{ fontSize: 12 }}>server/server.js</code> after <code style={{ fontSize: 12 }}>npm run build</code>
        , so the same HTTPS URL serves both the UI and the API. You usually do not need <code>VITE_API_URL</code>.
      </p>
      <p style={{ color: "#444", marginBottom: 16 }}>
        <strong>Frontend and API on different URLs:</strong> set <code style={{ fontSize: 12 }}>VITE_API_URL</code> to
        your API&apos;s HTTPS origin in the <em>frontend</em> build environment (any static host), rebuild, and
        ensure Google OAuth redirect URI is <code style={{ fontSize: 11 }}>https://YOUR-API-HOST/auth/google/callback</code>
        .
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
          Open Google sign-in (API: {apiBase})
        </button>
      </p>
      <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
        <Link to="/" style={{ color: "var(--tp-accent, #1a3a2a)", fontWeight: 600 }}>
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
