/**
 * AiReport.jsx
 * AI-generated bilingual investment report panel on the Stock page.
 * Only signed-in users can generate reports — guests see a sign-in prompt.
 */
import React, { useState, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { getApiUrl } from "../../config/env.js";

export function AiReport({ symbol, t }) {
  const { user, login } = useAuth();
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const iframeRef = useRef(null);

  const generate = useCallback(async (forceRefresh = false) => {
    if (!symbol || !user) return;
    setStatus("loading");
    setErrorMsg("");
    setHtmlContent("");
    try {
      const url = `${getApiUrl()}/api/ai-report/${encodeURIComponent(symbol)}/html${forceRefresh ? "?refresh=1" : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const html = await res.text();
      setHtmlContent(html);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err.message || "Failed to generate report");
      setStatus("error");
    }
  }, [symbol, user]);

  const onIframeLoad = useCallback(() => {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument;
      if (doc?.body) iframeRef.current.style.height = doc.body.scrollHeight + 32 + "px";
    } catch {}
  }, []);

  // GUEST — not signed in
  if (!user) {
    return (
      <div style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: 10, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <div style={{ color: "#c9a84c", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
          Sign in to access AI Reports
        </div>
        <div style={{ color: "#a0aec0", fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>
          Get a full bilingual (English &amp; Arabic) AI-generated investment report including
          fair value, red flag detection, future outlook, and a Buy/Hold/Sell recommendation.
        </div>
        <button
          type="button"
          onClick={() => login()}
          style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#fff", color: "#1a1a1a", borderRadius: 8, padding: "10px 22px", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
        <div style={{ color: "#4a5568", fontSize: 12, marginTop: 12 }}>
          Free to sign in · No credit card required
        </div>
      </div>
    );
  }

  // SIGNED IN — show report panel
  return (
    <div style={{ marginTop: 4 }}>
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16, padding: "14px 20px", background: "linear-gradient(135deg, #0d1f3c, #1a3c5e)", border: "1px solid #c9a84c", borderRadius: 10 }}>
        <div>
          <div style={{ color: "#c9a84c", fontWeight: 700, fontSize: 15, marginBottom: 3 }}>🤖 AI Financial Analyst Report</div>
          <div style={{ color: "#a0aec0", fontSize: 12 }}>Bilingual (EN/AR) · Powered by Claude · Data from FMP · Cached 7 days</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {status === "done" && (
            <button onClick={() => generate(true)} style={{ background: "transparent", border: "1px solid #c9a84c44", color: "#a0aec0", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
              ↻ Refresh
            </button>
          )}
          {status !== "loading" && status !== "done" && (
            <button onClick={() => generate(false)} style={{ background: "#c9a84c", border: "none", color: "#0a1628", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Generate Report
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {status === "loading" && (
        <div style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: 10, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ color: "#c9a84c", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Generating your report…</div>
          <div style={{ color: "#718096", fontSize: 13 }}>Fetching financial data from FMP and running AI analysis.<br />This takes 30–60 seconds.</div>
          <div style={{ margin: "20px auto 0", width: 180, height: 4, background: "#1e3a5f", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: "40%", height: "100%", background: "#c9a84c", borderRadius: 4, animation: "tp-ai-slide 1.5s ease-in-out infinite alternate" }} />
          </div>
          <style>{`@keyframes tp-ai-slide { from { margin-left:0 } to { margin-left:60% } }`}</style>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div style={{ background: "#1a0000", border: "1px solid #fc8181", borderRadius: 10, padding: 24, color: "#fc8181", fontSize: 14 }}>
          <strong>Report generation failed:</strong> {errorMsg}
          <br />
          <button onClick={() => generate(false)} style={{ marginTop: 12, background: "#c9a84c", border: "none", color: "#0a1628", borderRadius: 6, padding: "8px 18px", fontWeight: 700, cursor: "pointer" }}>
            Try Again
          </button>
        </div>
      )}

      {/* Report iframe */}
      {status === "done" && htmlContent && (
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          onLoad={onIframeLoad}
          title={`AI Report for ${symbol}`}
          style={{ width: "100%", minHeight: 600, border: "none", borderRadius: 10, background: "#0a1628" }}
          sandbox="allow-scripts"
        />
      )}
    </div>
  );
}
