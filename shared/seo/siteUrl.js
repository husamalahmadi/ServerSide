const DEFAULT_SITE_URL = "https://trueprice.cash";

let configuredSiteUrl = null;

function readEnvSiteUrl() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) {
      return String(import.meta.env.VITE_SITE_URL).trim();
    }
  } catch {
    /* not in Vite client bundle */
  }
  if (typeof process !== "undefined" && process.env?.VITE_SITE_URL) {
    return String(process.env.VITE_SITE_URL).trim();
  }
  return "";
}

/** Server may set canonical origin once at boot (e.g. https://trueprice.cash). */
export function configureSeoSiteUrl(url) {
  const clean = String(url || "").trim().replace(/\/+$/, "");
  configuredSiteUrl = clean || null;
}

export function getSeoSiteUrl() {
  const fromEnv = readEnvSiteUrl();
  const base = configuredSiteUrl || fromEnv || DEFAULT_SITE_URL;
  return base.replace(/\/+$/, "");
}
