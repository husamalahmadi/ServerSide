import React, { useState } from "react";
import { useI18n } from "../i18n.jsx";
import { getApiUrl } from "../config/env.js";

export function EmailDigestForm() {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus(t("DIGEST_INVALID"));
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch(`${getApiUrl()}/api/email/digest-subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, lang: lang === "ar" ? "ar" : "en" }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setEmail("");
      setStatus(t("DIGEST_DONE"));
    } catch {
      setStatus(t("RETRY_MSG"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ margin: "16px 0", display: "grid", gap: 8, maxWidth: 420 }}>
      <div style={{ fontWeight: 700 }}>{t("DIGEST_TITLE")}</div>
      <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>{t("DIGEST_HINT")}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("DIGEST_PLACEHOLDER")}
          autoComplete="email"
          required
          style={{ flex: "1 1 180px", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
        />
        <button type="submit" disabled={busy} className="tp-signin-google" style={{ cursor: "pointer" }}>
          {t("DIGEST_SUBSCRIBE")}
        </button>
      </div>
      {status ? <div style={{ fontSize: 13, color: "#374151" }}>{status}</div> : null}
    </form>
  );
}
