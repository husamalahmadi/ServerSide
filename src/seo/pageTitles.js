/** SEO recommendation: document title length 50–60 characters (including spaces). */
export const TITLE_MIN_LEN = 50;
export const TITLE_MAX_LEN = 60;

const BRAND = "TruePrice.Cash";
const BRAND_SUFFIX = ` – ${BRAND}`;

/** Default homepage title (59 characters). */
export const DEFAULT_DOCUMENT_TITLE =
  "TruePrice.Cash – Fair Value & Fundamentals (US, TASI, Tokyo)";

/**
 * Build a document title between 50 and 60 characters.
 * @param {string} [pageTitle] short label from the route (optional)
 */
export function formatDocumentTitle(pageTitle) {
  if (!pageTitle?.trim()) return DEFAULT_DOCUMENT_TITLE;

  let candidate = pageTitle.trim();
  if (!candidate.includes(BRAND)) {
    candidate = `${candidate}${BRAND_SUFFIX}`;
  }

  if (candidate.length > TITLE_MAX_LEN) {
    if (candidate.includes(BRAND) && !pageTitle.includes(BRAND)) {
      const maxBase = TITLE_MAX_LEN - BRAND_SUFFIX.length;
      let base = pageTitle.trim();
      if (base.length > maxBase) {
        base = base.slice(0, maxBase).replace(/\s+\S*$/, "").trim() || base.slice(0, maxBase);
      }
      candidate = `${base}${BRAND_SUFFIX}`;
    } else {
      candidate = candidate.slice(0, TITLE_MAX_LEN).replace(/\s+\S*$/, "").trim();
      if (!candidate) candidate = candidate.slice(0, TITLE_MAX_LEN);
    }
  }

  if (candidate.length < TITLE_MIN_LEN) {
    const pad = " – Fair Value & Stock Fundamentals";
    candidate = `${candidate}${pad}`;
    if (candidate.length > TITLE_MAX_LEN) {
      candidate = candidate.slice(0, TITLE_MAX_LEN).replace(/\s+\S*$/, "").trim();
    }
  }

  return candidate;
}
