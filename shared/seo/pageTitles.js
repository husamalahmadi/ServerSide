/** English document titles target 50–60 characters. Arabic has no minimum. */
export const TITLE_MIN_LEN = 50;
export const TITLE_MAX_LEN = 60;

const BRAND = "TruePrice.Cash";
const BRAND_SUFFIX = ` – ${BRAND}`;

/** Joiners that must not be left as the last token after a trim. */
const TRAILING_JOINERS = new Set(["&", "–", "—", "-", "|", "·"]);

/**
 * Whole phrases only. The first one that fits is used, so a title is never
 * padded with a fragment such as "Fair Value &".
 */
const EN_PADS = ["Fair Value & Stock Fundamentals", "Stock Fundamentals", "Fair Value"];

/** Default homepage title (59 characters). */
export const DEFAULT_DOCUMENT_TITLE =
  "TruePrice.Cash – Fair Value for US, TASI, Tokyo & LSE";

/** /methodology title per language (50–60 characters). */
export const METHODOLOGY_DOCUMENT_TITLE = {
  en: "How We Calculate Fair Value – TruePrice.Cash Method",
  ar: "كيف نحسب القيمة العادلة للأسهم – منهجية TruePrice.Cash",
};

function inferLang(text, lang) {
  if (lang === "ar" || lang === "en") return lang;
  const arabic = (String(text).match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (String(text).match(/[A-Za-z]/g) || []).length;
  return arabic > latin ? "ar" : "en";
}

/** Keep a prefix of whole tokens that fits in max, and do not end on a joiner. */
function fitTokens(text, max) {
  const tokens = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const kept = [];
  for (const token of tokens) {
    const next = kept.length ? `${kept.join(" ")} ${token}` : token;
    if (next.length > max) break;
    kept.push(token);
  }
  while (kept.length && TRAILING_JOINERS.has(kept[kept.length - 1])) kept.pop();
  return kept.join(" ");
}

/**
 * Build a document title. English titles are padded to 50–60 characters when a
 * whole pad phrase fits. Arabic titles are not padded to a minimum. Truncation
 * drops whole tokens only.
 * @param {string} [pageTitle]
 * @param {"en"|"ar"} [lang]
 */
export function formatDocumentTitle(pageTitle, lang) {
  if (!pageTitle?.trim()) return DEFAULT_DOCUMENT_TITLE;

  const language = inferLang(pageTitle, lang);
  const raw = pageTitle.trim();

  if (raw.includes(BRAND)) {
    return fitTokens(raw, TITLE_MAX_LEN) || DEFAULT_DOCUMENT_TITLE;
  }

  const maxBase = TITLE_MAX_LEN - BRAND_SUFFIX.length;
  let base = fitTokens(raw, maxBase);
  if (!base) return DEFAULT_DOCUMENT_TITLE;

  let candidate = `${base}${BRAND_SUFFIX}`;
  if (language !== "ar" && candidate.length < TITLE_MIN_LEN) {
    for (const pad of EN_PADS) {
      const paddedBase = `${base} ${pad}`;
      if (paddedBase.length <= maxBase) {
        candidate = `${paddedBase}${BRAND_SUFFIX}`;
        break;
      }
    }
  }

  return candidate.length <= TITLE_MAX_LEN ? candidate : fitTokens(candidate, TITLE_MAX_LEN);
}
