import React from "react";
import { Link } from "react-router-dom";

/**
 * Shown when the user opens /auth/* on static hosting (SPA fallback) instead of the Express OAuth URL.
 */
export default function AuthSignInHelp() {
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
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Google sign-in uses the API server</h1>
      <p style={{ color: "#444", marginBottom: 12 }}>
        This page is static hosting. Sign-in is handled by the Express app in{" "}
        <code style={{ fontSize: 13 }}>server/</code>, not by Cloudflare Pages or Vercel alone.
      </p>
      <p style={{ color: "#444", marginBottom: 16 }}>
        Deploy <strong>server/</strong> (e.g. Railway, Render), set{" "}
        <strong>VITE_API_URL</strong> in your frontend project to that API&apos;s HTTPS URL, redeploy the
        frontend, then use <strong>Sign in with Google</strong> again.
      </p>
      <p style={{ margin: 0 }}>
        <Link to="/" style={{ color: "var(--tp-accent, #1a3a2a)", fontWeight: 600 }}>
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
