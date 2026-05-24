import React from "react";
import ReactDOM from "react-dom/client";

// Strip legacy ?auth=api_required again before React (defense in depth vs cached bundles).
try {
  const u = new URL(window.location.href);
  if (u.searchParams.get("auth") === "api_required") {
    u.searchParams.delete("auth");
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  }
} catch {
  /* ignore */
}
import "./index.css";
import "./styles/tp-theme.css";
import { initAnalytics } from "./analytics.js";
import { initWebVitalsReporting } from "./webVitals.js";
import App from "./routes/App.jsx";

initAnalytics();
initWebVitalsReporting();

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("[TruePrice] Missing #root — cannot start the app.");
} else {
  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    document.documentElement.classList.add("tp-app-ready");
  } catch (err) {
    console.error("[TruePrice] App failed to start:", err);
    const fallback = document.getElementById("tp-static-fallback");
    if (fallback && !fallback.querySelector(".tp-boot-warn")) {
      const p = document.createElement("p");
      p.className = "tp-boot-warn";
      p.textContent = String(err?.message || err || "App failed to load.");
      fallback.appendChild(p);
    }
  }
}
