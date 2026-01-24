// FILE: client/src/services/translateService.js
/**
 * English → Arabic translation via MyMemory API (no key required).
 * Caches results; chunks text > ~400 chars to respect 500-byte limit.
 */

const MYMEMORY = "https://api.mymemory.translated.net/get";
const MAX_CHARS = 400;
const CACHE = new Map();

function cacheKey(text, lang) {
  return `en|${lang}|${text}`;
}

function chunkText(text) {
  if (!text || text.length <= MAX_CHARS) return [text].filter(Boolean);
  const chunks = [];
  let rest = text;
  while (rest.length) {
    if (rest.length <= MAX_CHARS) {
      chunks.push(rest);
      break;
    }
    const lastPeriod = rest.slice(0, MAX_CHARS).lastIndexOf(". ");
    const lastSpace = rest.slice(0, MAX_CHARS).lastIndexOf(" ");
    const idx = lastPeriod >= MAX_CHARS / 2 ? lastPeriod + 1 : lastSpace >= MAX_CHARS / 2 ? lastSpace + 1 : MAX_CHARS;
    const split = rest.slice(0, idx).trimEnd();
    rest = rest.slice(idx).trimStart();
    if (split) chunks.push(split);
  }
  return chunks.filter(Boolean);
}

async function fetchTranslation(text) {
  const url = `${MYMEMORY}?q=${encodeURIComponent(text)}&langpair=en|ar`;
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  let json = {};
  try {
    json = txt ? JSON.parse(txt) : {};
  } catch {
    return null;
  }
  const translated = json?.responseData?.translatedText;
  return translated && typeof translated === "string" ? translated : null;
}

/**
 * Translate English text to Arabic. Returns original if translation fails.
 * @param {string} text - English text
 * @param {{ to?: string }} [opts] - to: 'ar' (default)
 * @returns {Promise<string>}
 */
export async function translateToArabic(text, opts = {}) {
  const to = opts?.to || "ar";
  if (to !== "ar" || !text || typeof text !== "string") return text;
  const trimmed = text.trim();
  if (!trimmed) return text;

  const key = cacheKey(trimmed, to);
  if (CACHE.has(key)) return CACHE.get(key);

  const chunks = chunkText(trimmed);
  const results = [];
  for (const chunk of chunks) {
    const k = cacheKey(chunk, to);
    if (CACHE.has(k)) {
      results.push(CACHE.get(k));
      continue;
    }
    const translated = await fetchTranslation(chunk);
    const out = translated || chunk;
    CACHE.set(k, out);
    results.push(out);
  }
  const joined = results.join(chunks.length > 1 ? " " : "");
  CACHE.set(key, joined);
  return joined;
}
