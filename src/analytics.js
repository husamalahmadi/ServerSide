/**
 * GA4, Microsoft Clarity, optional Hotjar — IDs from Vite env at build time.
 * GA4 uses manual page_view events so React Router navigations are counted.
 */

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const CLARITY_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;
const HOTJAR_ID = import.meta.env.VITE_HOTJAR_SITE_ID;
const GSC_VER = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION;

function injectGoogleSiteVerification() {
  if (!GSC_VER || typeof document === "undefined") return;
  const m = document.createElement("meta");
  m.name = "google-site-verification";
  m.content = GSC_VER;
  document.head.appendChild(m);
}

function sendGaPageView() {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: window.location.pathname + window.location.search,
    page_title: document.title,
    page_location: window.location.href,
  });
}

function gtagScriptAlreadyPresent(gaId) {
  for (const el of document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]')) {
    try {
      if (new URL(el.src).searchParams.get("id") === gaId) return true;
    } catch {
      if (el.src.includes(encodeURIComponent(gaId)) || el.src.includes(gaId)) return true;
    }
  }
  return false;
}

function loadGtag() {
  if (!GA_ID) return;
  // index.html may already include the Google tag; avoid a second gtag.js load.
  if (gtagScriptAlreadyPresent(GA_ID)) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false });

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  s.onload = () => {
    sendGaPageView();
  };
  document.head.appendChild(s);
}

function loadClarity() {
  if (!CLARITY_ID || HOTJAR_ID) return;
  (function (c, l, a, r, i, t, y) {
    c[a] =
      c[a] ||
      function () {
        (c[a].q = c[a].q || []).push(arguments);
      };
    t = l.createElement(r);
    t.async = 1;
    t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_ID);
}

function loadHotjar() {
  if (!HOTJAR_ID) return;
  const h = window;
  const d = document;
  h.hj =
    h.hj ||
    function () {
      (h.hj.q = h.hj.q || []).push(arguments);
    };
  h._hjSettings = { hjid: Number(HOTJAR_ID), hjsv: 6 };
  const a = d.getElementsByTagName("head")[0];
  const r = d.createElement("script");
  r.async = 1;
  r.src = "https://static.hotjar.com/c/hotjar-" + h._hjSettings.hjid + ".js?sv=" + h._hjSettings.hjsv;
  a.appendChild(r);
}

/**
 * Call once at app startup (before or right after React root).
 */
export function initAnalytics() {
  if (typeof window === "undefined") return;
  injectGoogleSiteVerification();
  loadGtag();
  if (HOTJAR_ID) {
    loadHotjar();
  } else {
    loadClarity();
  }
}

/**
 * Call on every client-side route change (React Router).
 */
export function trackPageView() {
  sendGaPageView();
}
