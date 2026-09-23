/**
 * Email-only weekly digest. No user account. Sends only when Resend is configured.
 */
import { randomBytes } from "crypto";
import { emailConfigured, sendEmail } from "./emailNotifications.js";

const WEEK_MS = 6 * 24 * 60 * 60 * 1000;

function newToken() {
  return randomBytes(16).toString("hex");
}

function validEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length < 5 || email.length > 200) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

export function subscribeDigest(db, { email, lang }) {
  const address = validEmail(email);
  if (!address) return { ok: false, error: "invalid_email" };
  const language = lang === "ar" ? "ar" : "en";
  const existing = db.prepare("SELECT id FROM email_digest_subscribers WHERE email=?").get(address);
  if (existing) {
    db.prepare("UPDATE email_digest_subscribers SET lang=? WHERE id=?").run(language, existing.id);
    return { ok: true };
  }
  db.prepare(
    "INSERT INTO email_digest_subscribers (email, lang, unsubscribe_token) VALUES (?, ?, ?)"
  ).run(address, language, newToken());
  return { ok: true };
}

export function unsubscribeDigest(db, token) {
  const t = String(token || "").trim();
  if (!t) return false;
  const row = db.prepare("SELECT id FROM email_digest_subscribers WHERE unsubscribe_token=?").get(t);
  if (!row) return false;
  db.prepare("DELETE FROM email_digest_subscribers WHERE id=?").run(row.id);
  return true;
}

function digestBody(siteUrl, unsubscribeUrl, lang) {
  const ar = lang === "ar";
  const subject = ar ? "القيمة العادلة هذا الأسبوع — TruePrice.Cash" : "This week’s fair value — TruePrice.Cash";
  const intro = ar
    ? "روابط أسواق هذا الأسبوع. لا حاجة لحساب."
    : "This week’s market links. No account needed.";
  const links = [
    [ar ? "سوق السعودية" : "Saudi market", `${siteUrl}/sa-markets`],
    [ar ? "السوق الأمريكي" : "US market", `${siteUrl}/us-markets`],
    [ar ? "المنهجية" : "Methodology", `${siteUrl}/methodology`],
  ];
  const html = `<p>${intro}</p><ul>${links
    .map(([label, href]) => `<li><a href="${href}">${label}</a></li>`)
    .join("")}</ul><p><a href="${unsubscribeUrl}">${ar ? "إلغاء الاشتراك" : "Unsubscribe"}</a></p>`;
  const text = [intro, ...links.map(([label, href]) => `${label}: ${href}`), unsubscribeUrl].join("\n");
  return { subject, html, text };
}

/** Send at most one digest per subscriber per six days. */
export async function sendDueWeeklyDigests({ db, siteUrl, apiUrl }) {
  if (!emailConfigured()) return { sent: 0, skipped: "email_not_configured" };
  const rows = db.prepare("SELECT id, email, lang, unsubscribe_token, last_sent_at FROM email_digest_subscribers").all();
  const now = Date.now();
  let sent = 0;
  for (const row of rows) {
    const last = row.last_sent_at ? Date.parse(row.last_sent_at) : 0;
    if (last && now - last < WEEK_MS) continue;
    const unsubscribeUrl = `${apiUrl}/api/email/digest-unsubscribe?token=${encodeURIComponent(row.unsubscribe_token)}`;
    const message = digestBody(siteUrl, unsubscribeUrl, row.lang);
    const result = await sendEmail({
      to: row.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
      },
    });
    if (result.ok) {
      db.prepare("UPDATE email_digest_subscribers SET last_sent_at=datetime('now') WHERE id=?").run(row.id);
      sent += 1;
    }
  }
  return { sent };
}
