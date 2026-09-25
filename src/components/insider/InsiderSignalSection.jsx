import React, { useState } from "react";
import { useI18n } from "../../i18n.jsx";
import { InsiderFootprintPanel } from "./InsiderFootprintPanel.jsx";
import { fetchInsiderSignal } from "../../services/insiderSignalService.js";

const US_ONLY = "Insider filings are available for US-listed stocks only.";

export function InsiderSignalSection({ symbol, market }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const us = market === "us";

  const load = async () => {
    if (!symbol || !us) return;
    setStatus("loading");
    setError("");
    setData(null);
    try {
      const next = await fetchInsiderSignal(symbol);
      setData(next);
      setStatus("done");
    } catch (err) {
      setError(err?.message || "Could not load insider data.");
      setStatus("error");
    }
  };

  return (
    <div className="tp-ifp-launch">
      <div className="tp-ifp-launch-bar">
        <div>
          <div className="tp-ifp-launch-title">{t("INSIDER_NAV")}</div>
          <div className="tp-ifp-launch-sub">{us ? t("INSIDER_LEDE") : US_ONLY}</div>
        </div>
        {us && status !== "loading" ? (
          <button type="button" className="tp-ifp-launch-btn" onClick={load}>
            {status === "done" ? t("INSIDER_REFRESH") : t("INSIDER_BUTTON")}
          </button>
        ) : null}
      </div>

      {us && status === "loading" ? (
        <div className="tp-ifp-canvas tp-ifp-canvas-wait">
          <div className="tp-ifp-wait-title">{t("INSIDER_LOADING")}</div>
          <div className="tp-ifp-wait-bar" aria-hidden><span /></div>
        </div>
      ) : null}

      {us && status === "error" ? (
        <div className="tp-ifp-canvas tp-ifp-canvas-error" role="alert">
          {error}
        </div>
      ) : null}

      {us && status === "done" && (data?.status === "us-only" || data?.status === "not-found") ? (
        <div className="tp-ifp-canvas tp-ifp-canvas-wait">{data.message}</div>
      ) : null}

      {us && status === "done" && data?.status === "ok" ? (
        <div className="tp-ifp-canvas" tabIndex={0}>
          <InsiderFootprintPanel data={data} />
        </div>
      ) : null}
    </div>
  );
}
