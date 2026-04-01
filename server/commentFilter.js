/**
 * Comment content filter: blocks URLs, hyperlinks, and profanity.
 * Used server-side for all comment submissions.
 */

// Common profanity and slurs (base forms + common variants)
// Using a compact representation to avoid explicit listing
const BAD_WORDS = [
  "shit", "sh1t", "sh!t", "sht", "shiiit",
  "fuck", "fck", "fuk", "f***", "fck",
  "damn", "damm",
  "ass", "a55", "a$$",
  "bitch", "b1tch", "btch", "biatch",
  "bastard", "basterd",
  "crap", "cr@p",
  "dick", "d1ck",
  "hell", "h3ll", "he11",
  "idiot", "1diot",
  "stupid", "stoopid",
  "cunt", "c*nt", "c unt",
  "nigger", "nigga", "n1gger", "n1gga",
  "faggot", "fag", "f@g",
  "retard", "retarded", "r3tard",
  "whore", "wh0re",
  "slut", "s1ut",
  "pussy", "pussies",
  "cock", "c0ck",
  "penis", "dick",
  "vagina",
  "kill", "k1ll", "k!ll",
  "die", "d1e",
  "hate", "h8",
  "suck", "suk",
];

// Normalize text for comparison: leetspeak to letters, collapse repeats
function normalizeForMatch(text) {
  return String(text)
    .toLowerCase()
    .replace(/[0-9@$]/g, (c) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", "$": "s" }[c] ?? ""))
    .replace(/[!|]/g, "i")
    .replace(/\*+/g, "")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[^a-z\s]/g, " ");
}

// Check if text contains bad words (word-boundary aware to avoid false positives like "class" matching "ass")
function containsBadWord(text) {
  const normalized = normalizeForMatch(text);
  for (const bad of BAD_WORDS) {
    const badNorm = normalizeForMatch(bad);
    if (badNorm.length < 2) continue;
    const re = new RegExp("(^|\\s)" + badNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s|$)", "i");
    if (re.test(normalized)) return true;
  }
  return false;
}

function containsUrl(text) {
  return (
    /https?:\/\/[^\s]*/i.test(text) ||
    /\bwww\.[^\s]+/i.test(text) ||
    /\b[a-z0-9-]+\.(com|org|net|io|co|uk|de|fr|info|biz|me|tv|edu|gov)(\/[^\s]*)?/i.test(text) ||
    /\[([^\]]+)\]\([^)]+\)/.test(text) ||
    /<a\s+[^>]*href\s*=/i.test(text)
  );
}

/**
 * Validate and optionally sanitize comment body.
 * @param {string} body - Raw comment text
 * @returns {{ valid: boolean, reason?: string, filtered?: string }}
 */
export function validateComment(body) {
  if (!body || typeof body !== "string") {
    return { valid: false, reason: "Comment is required" };
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: "Comment cannot be empty" };
  }
  if (trimmed.length > 2000) {
    return { valid: false, reason: "Comment is too long (max 2000 characters)" };
  }
  if (containsUrl(trimmed)) {
    return { valid: false, reason: "Links and URLs are not allowed in comments" };
  }
  if (containsBadWord(trimmed)) {
    return { valid: false, reason: "Your comment contains inappropriate language. Please keep it respectful." };
  }
  return { valid: true, filtered: trimmed };
}
