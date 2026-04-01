/**
 * Client-side comment validation for immediate user feedback.
 * Server performs authoritative validation; this provides quick feedback.
 */

// URL/hyperlink detection
const URL_REGEX = /https?:\/\/|www\.|\.(com|org|net|io|co|uk)\b|\[[^\]]+\]\([^)]+\)|<a\s+[^>]*href/i;

// Common profanity (subset for client - server has full list)
const BAD_WORDS = [
  "shit", "fuck", "damn", "ass", "bitch", "crap", "hell", "idiot", "stupid",
  "cunt", "nigger", "nigga", "faggot", "fag", "retard", "whore", "slut",
  "pussy", "cock", "dick", "kill", "die", "hate",
];

function normalizeForMatch(text) {
  return String(text)
    .toLowerCase()
    .replace(/[0-9@$]/g, (c) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" }[c] ?? ""))
    .replace(/[!|]/g, "i")
    .replace(/\*+/g, "")
    .replace(/[^a-z\s]/g, " ");
}

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
  if (URL_REGEX.test(trimmed)) {
    return { valid: false, reason: "Links and URLs are not allowed in comments" };
  }
  if (containsBadWord(trimmed)) {
    return { valid: false, reason: "Your comment contains inappropriate language. Please keep it respectful." };
  }
  return { valid: true };
}
