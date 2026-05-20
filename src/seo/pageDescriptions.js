/** SEO recommendation: meta description length 120–160 characters (including spaces). */
export const META_DESC_MIN_LEN = 120;
export const META_DESC_MAX_LEN = 160;

/** Homepage / default (150 characters). */
export const DEFAULT_META_DESCRIPTION =
  "Analyze US, Saudi (TASI), and Tokyo stocks on TruePrice.Cash — fair value estimates, financial statements, fundamentals, and a stock screener.";

const PAD_SUFFIX =
  " Explore tickers, compare valuations, and read fundamentals on TruePrice.Cash.";

/**
 * @param {string} [text]
 * @returns {string}
 */
export function formatMetaDescription(text) {
  if (!text?.trim()) return DEFAULT_META_DESCRIPTION;

  let candidate = text.trim().replace(/\s+/g, " ");

  if (candidate.length > META_DESC_MAX_LEN) {
    candidate = candidate.slice(0, META_DESC_MAX_LEN).replace(/\s+\S*$/, "").trim();
    if (!candidate) candidate = text.trim().slice(0, META_DESC_MAX_LEN);
  }

  if (candidate.length < META_DESC_MIN_LEN) {
    candidate = `${candidate}${PAD_SUFFIX}`;
    if (candidate.length > META_DESC_MAX_LEN) {
      candidate = candidate.slice(0, META_DESC_MAX_LEN).replace(/\s+\S*$/, "").trim();
    }
  }

  return candidate;
}
