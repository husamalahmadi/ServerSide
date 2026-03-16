/**
 * Analytics service - tracks page hits, user activity, and IP.
 * Note: MAC address is NOT available in web browsers (security restriction).
 */

const API_BASE = import.meta.env.DEV ? "/api" : "/api";

function generateSessionId() {
  return "sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 11);
}

function getOrCreateSessionId() {
  let id = sessionStorage.getItem("tp_analytics_sid");
  if (!id) {
    id = generateSessionId();
    sessionStorage.setItem("tp_analytics_sid", id);
  }
  return id;
}

async function fetchIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return data?.ip || null;
  } catch {
    return null;
  }
}

function getPageInfo() {
  return {
    path: window.location.pathname,
    href: window.location.href,
    referrer: document.referrer || null,
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
  };
}

async function sendEvent(type, payload = {}) {
  const sessionId = getOrCreateSessionId();
  const pageInfo = getPageInfo();

  const body = {
    type,
    sessionId,
    timestamp: new Date().toISOString(),
    ...pageInfo,
    ...payload,
  };

  try {
    const ip = await fetchIp();
    if (ip) body.ip = ip;
  } catch {
    /* ignore */
  }

  try {
    await fetch(`${API_BASE}/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn("[Analytics] Failed to send event:", err);
  }
}

export const analytics = {
  /** Track initial page hit (call once on homepage/landing) */
  trackPageHit() {
    sendEvent("page_hit", { landing: true });
  },

  /** Track route/page change */
  trackPageView(path, extra = {}) {
    sendEvent("page_view", { path, ...extra });
  },

  /** Track user action (e.g. stock viewed, search, click) */
  trackAction(action, data = {}) {
    sendEvent("action", { action, ...data });
  },

  /** Track stock view */
  trackStockView(ticker, market) {
    sendEvent("action", { action: "stock_view", ticker, market });
  },

  /** Track search */
  trackSearch(query, resultsCount) {
    sendEvent("action", { action: "search", query, resultsCount });
  },
};
