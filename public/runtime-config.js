/**
 * Runtime API base URL (loaded before the Vite bundle).
 *
 * Production API is served at https://www.trueprice.cash/api (proxied to Render).
 * Do not use the bare trueprice.cash host for API calls — it 301s to www and breaks fetch.
 *
 * Override in production by editing this file or setting before load:
 *   window.__TP_PUBLIC_API_URL__ = "https://your-api-host";
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__TP_PUBLIC_API_URL__) return;

  const host = (window.location.hostname || "").toLowerCase();
  const isProdWeb =
    host === "trueprice.cash" ||
    host === "www.trueprice.cash" ||
    host.endsWith(".trueprice.cash");

  if (isProdWeb) {
    window.__TP_PUBLIC_API_URL__ = "https://www.trueprice.cash";
  }
})();
