/**
 * Runtime API base URL (loaded before the Vite bundle).
 *
 * Cloudflare Pages serves only static files — /api/* on trueprice.cash does not reach Express.
 * Stock quotes and financials must call the Node API (e.g. Render).
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
    window.__TP_PUBLIC_API_URL__ = "https://trueprice-api.onrender.com";
  }
})();
