/** Open Graph image paths. Crawlers fetch these URLs; they do not run page scripts. */

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const DEFAULT_OG_IMAGE_PATH = "/og/default.png";

export function stockOgImagePath(locale, ticker) {
  const lang = locale === "ar" ? "ar" : "en";
  const symbol = encodeURIComponent(String(ticker || "").trim());
  return `/og/${lang}/stock/${symbol}.png`;
}
