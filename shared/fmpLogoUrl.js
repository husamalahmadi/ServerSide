export const FMP_IMAGE_STOCK_BASE = "https://financialmodelingprep.com/image-stock";

/** FMP hosted logo PNG for a ticker (works for US, .SR, .T, .L, etc.). */
export function fmpImageStockUrl(symbol) {
  const sym = String(symbol || "").trim();
  if (!sym) return null;
  return `${FMP_IMAGE_STOCK_BASE}/${encodeURIComponent(sym)}.png`;
}

/** Prefer profile `image`, then FMP image-stock. Clearbit is intentionally omitted (service discontinued). */
export function resolveFmpLogoUrl(raw, symbol) {
  const sym = String(raw?.symbol ?? symbol ?? "").trim();
  let logoUrl = null;
  const img = raw?.image;
  if (typeof img === "string") {
    const trimmed = img.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      logoUrl = trimmed;
    } else if (trimmed.startsWith("/")) {
      logoUrl = `https://financialmodelingprep.com${trimmed}`;
    }
  }
  if (!logoUrl && sym) logoUrl = fmpImageStockUrl(sym);
  return logoUrl;
}
