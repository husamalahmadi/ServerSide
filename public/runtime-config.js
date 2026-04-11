/**
 * If the site is on a different host than the API (e.g. trueprice.cash → trueprice-api.onrender.com),
 * set this to your API origin (https, no trailing slash). Otherwise /auth/me hits the wrong host and
 * you stay on "couldn't load session" after Google sign-in.
 *
 * Example: window.__TP_PUBLIC_API_URL__ = "https://trueprice-api.onrender.com";
 * Leave "" when the SPA and API share the same origin (single Render service).
 */
window.__TP_PUBLIC_API_URL__ = window.__TP_PUBLIC_API_URL__ || "";
