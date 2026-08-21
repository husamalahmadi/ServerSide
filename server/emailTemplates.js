/**
 * Bilingual fair-value alert email and unsubscribe page.
 *
 * v1 sends one email carrying an English block followed by an Arabic block, because no
 * per-user locale is stored — that way we never guess wrong about a reader's language.
 * TODO(email-lang): once `users` carries an `email_lang` preference, render only that
 * language and drop the second block.
 *
 * HTML here must survive email clients: inline styles, table layout, no external CSS.
 */
import EN from "../src/locales/en.js";
import AR from "../src/locales/ar.js";

const NAVY = "#0f2233";
const GOLD = "#c9a84c";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const PAGE_BG = "#f4f5f7";

const COPY = {
  en: {
    dir: "ltr",
    align: "left",
    HEADING: "Fair value update",
    INTRO: "These stocks on your watchlists moved enough to be worth a look.",
    LINE_NOW_UNDERVALUED: "{ticker} is now undervalued",
    LINE_NOW_OVERVALUED: "{ticker} is now overvalued",
    LINE_MOVE: "{ticker} fair value moved {pct}%",
    FAIR_VALUE_NOW: "Fair value now",
    FAIR_VALUE_AT_ADD: "when you added it",
    PRICE: "Price",
    WATCHLIST: "Watchlist",
    VIEW_STOCK: "Open {ticker}",
    METHODOLOGY: "How we calculate fair value",
    ESTIMATE_NOTE: "Fair value is a model-based estimate, not advice.",
    DISCLAIMER: EN.CMA_DISCLAIMER,
    UNSUBSCRIBE: "Unsubscribe from fair-value emails",
  },
  ar: {
    dir: "rtl",
    align: "right",
    HEADING: "تحديث القيمة العادلة",
    INTRO: "هذه الأسهم في قوائم مراقبتك تغيّرت بما يستحق النظر.",
    LINE_NOW_UNDERVALUED: "{ticker} أصبح مقوّماً بأقل من قيمته",
    LINE_NOW_OVERVALUED: "{ticker} أصبح مقوّماً بأعلى من قيمته",
    LINE_MOVE: "{ticker} تغيّرت قيمته العادلة بنسبة {pct}%",
    FAIR_VALUE_NOW: "القيمة العادلة الآن",
    FAIR_VALUE_AT_ADD: "عند الإضافة",
    PRICE: "السعر",
    WATCHLIST: "قائمة المراقبة",
    VIEW_STOCK: "عرض {ticker}",
    METHODOLOGY: "كيف نحسب القيمة العادلة",
    ESTIMATE_NOTE: "القيمة العادلة تقدير مبني على نموذج حسابي وليست نصيحة استثمارية.",
    DISCLAIMER: AR.CMA_DISCLAIMER,
    UNSUBSCRIBE: "إلغاء الاشتراك في تنبيهات القيمة العادلة",
  },
};

const UNSUBSCRIBED_PAGE_COPY = {
  en: {
    dir: "ltr",
    TITLE: "You're unsubscribed",
    BODY: "You will no longer receive fair-value change emails. You can turn them back on any time from your profile settings.",
    BACK: "Back to TruePrice.cash",
  },
  ar: {
    dir: "rtl",
    TITLE: "تم إلغاء الاشتراك",
    BODY: "لن تصلك رسائل تغيّر القيمة العادلة بعد الآن. يمكنك إعادة تشغيلها في أي وقت من إعدادات ملفك الشخصي.",
    BACK: "العودة إلى TruePrice.cash",
  },
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fill(template, values) {
  return Object.entries(values).reduce(
    (out, [k, v]) => out.replaceAll(`{${k}}`, String(v)),
    String(template)
  );
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return x.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** One change row (activity metadata) reduced to what both languages need. */
function normalizeChange(change) {
  const meta = change?.metadata || {};
  const pct = Number(meta.movePct);
  return {
    ticker: String(change?.ticker || meta.ticker || "").toUpperCase(),
    reason: meta.reason || "move",
    pct: Number.isFinite(pct) ? Math.abs(Math.round(pct)) : null,
    fairValueNow: fmtMoney(meta.lastKnownFv),
    fairValueAtAdd: fmtMoney(meta.fairValueAtAdd),
    price: fmtMoney(meta.price),
    currency: meta.currency || "",
    watchlistName: meta.watchlistName || null,
  };
}

function headlineFor(change, copy) {
  const values = { ticker: change.ticker, pct: change.pct ?? 0 };
  if (change.reason === "now_undervalued") return fill(copy.LINE_NOW_UNDERVALUED, values);
  if (change.reason === "now_overvalued") return fill(copy.LINE_NOW_OVERVALUED, values);
  return fill(copy.LINE_MOVE, values);
}

/** "Fair value now 130 USD (when you added it: 100 USD) · Price 120 USD" */
function detailFor(change, copy) {
  const parts = [];
  if (change.fairValueNow) {
    const now = `${copy.FAIR_VALUE_NOW}: ${change.fairValueNow} ${change.currency}`.trim();
    parts.push(
      change.fairValueAtAdd
        ? `${now} (${copy.FAIR_VALUE_AT_ADD}: ${change.fairValueAtAdd} ${change.currency})`.trim()
        : now
    );
  }
  if (change.price) parts.push(`${copy.PRICE}: ${change.price} ${change.currency}`.trim());
  if (change.watchlistName) parts.push(`${copy.WATCHLIST}: ${change.watchlistName}`);
  return parts.join(" · ");
}

function changeRowHtml(change, copy, siteUrl) {
  const stockUrl = `${siteUrl}/stock/${encodeURIComponent(change.ticker)}`;
  return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${LINE};" dir="${copy.dir}" align="${copy.align}">
            <div style="font:600 16px/1.4 Arial,Helvetica,sans-serif;color:${INK};">${escapeHtml(headlineFor(change, copy))}</div>
            <div style="font:400 13px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};margin-top:4px;">${escapeHtml(detailFor(change, copy))}</div>
            <div style="margin-top:8px;">
              <a href="${escapeHtml(stockUrl)}" style="font:600 13px/1 Arial,Helvetica,sans-serif;color:${NAVY};text-decoration:underline;">${escapeHtml(fill(copy.VIEW_STOCK, { ticker: change.ticker }))}</a>
            </div>
          </td>
        </tr>`;
}

function languageBlockHtml(lang, changes, siteUrl) {
  const copy = COPY[lang];
  return `
      <tr>
        <td style="padding:24px 28px 0 28px;" dir="${copy.dir}" align="${copy.align}">
          <h1 style="margin:0;font:700 20px/1.3 Arial,Helvetica,sans-serif;color:${NAVY};">${escapeHtml(copy.HEADING)}</h1>
          <p style="margin:8px 0 0 0;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">${escapeHtml(copy.INTRO)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${changes
            .map((c) => changeRowHtml(c, copy, siteUrl))
            .join("")}
          </table>
          <div style="margin-top:16px;" dir="${copy.dir}" align="${copy.align}">
            <a href="${escapeHtml(`${siteUrl}/methodology`)}" style="font:600 13px/1 Arial,Helvetica,sans-serif;color:${NAVY};text-decoration:underline;">${escapeHtml(copy.METHODOLOGY)}</a>
          </div>
          <p style="margin:12px 0 0 0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};" dir="${copy.dir}" align="${copy.align}">${escapeHtml(copy.ESTIMATE_NOTE)}</p>
        </td>
      </tr>`;
}

function footerBlockHtml(lang, unsubscribeUrl) {
  const copy = COPY[lang];
  return `
          <p style="margin:0 0 10px 0;font:400 11px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};" dir="${copy.dir}" align="${copy.align}">${escapeHtml(copy.DISCLAIMER)}</p>
          <p style="margin:0 0 16px 0;" dir="${copy.dir}" align="${copy.align}">
            <a href="${escapeHtml(unsubscribeUrl)}" style="font:400 11px/1 Arial,Helvetica,sans-serif;color:${MUTED};text-decoration:underline;">${escapeHtml(copy.UNSUBSCRIBE)}</a>
          </p>`;
}

function languageBlockText(lang, changes, siteUrl, unsubscribeUrl) {
  const copy = COPY[lang];
  const lines = [copy.HEADING, copy.INTRO, ""];
  for (const change of changes) {
    lines.push(`- ${headlineFor(change, copy)}`);
    const detail = detailFor(change, copy);
    if (detail) lines.push(`  ${detail}`);
    lines.push(`  ${siteUrl}/stock/${encodeURIComponent(change.ticker)}`);
  }
  lines.push("", `${copy.METHODOLOGY}: ${siteUrl}/methodology`, copy.ESTIMATE_NOTE, "", copy.DISCLAIMER, "", `${copy.UNSUBSCRIBE}: ${unsubscribeUrl}`);
  return lines.join("\n");
}

function subjectFor(changes) {
  if (changes.length === 1) {
    const t = changes[0].ticker;
    return `Fair value changed for ${t} — تغيّرت القيمة العادلة لـ ${t}`;
  }
  return `Fair value changed for ${changes.length} watched stocks — تغيّرت القيمة العادلة لـ ${changes.length} أسهم`;
}

/**
 * One digest email covering every pending change for a single user.
 * @param {{ changes: {ticker: string, metadata: object}[], siteUrl: string, unsubscribeUrl: string }} args
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildFairValueDigestEmail({ changes, siteUrl, unsubscribeUrl }) {
  const normalized = (changes || []).map(normalizeChange).filter((c) => c.ticker);
  const site = String(siteUrl || "").replace(/\/+$/, "");

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subjectFor(normalized))}</title></head>
<body style="margin:0;padding:0;background:${PAGE_BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="background:${NAVY};padding:20px 28px;border-bottom:3px solid ${GOLD};">
              <span style="font:700 18px/1 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:0.02em;">TruePrice<span style="color:${GOLD};">.cash</span></span>
            </td>
          </tr>
${languageBlockHtml("en", normalized, site)}
          <tr><td style="padding:0 28px;"><div style="height:1px;background:${LINE};"></div></td></tr>
${languageBlockHtml("ar", normalized, site)}
          <tr>
            <td style="background:#fafafa;border-top:1px solid ${LINE};padding:18px 28px;">
${footerBlockHtml("en", unsubscribeUrl)}
${footerBlockHtml("ar", unsubscribeUrl)}
              <p style="margin:0;font:400 11px/1 Arial,Helvetica,sans-serif;color:${MUTED};" align="center">© TruePrice.cash</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    languageBlockText("en", normalized, site, unsubscribeUrl),
    "",
    "———",
    "",
    languageBlockText("ar", normalized, site, unsubscribeUrl),
  ].join("\n");

  return { subject: subjectFor(normalized), html, text };
}

/**
 * Unsubscribe confirmation. Shown for any token, valid or not, so the page never
 * reveals whether a token exists.
 */
export function renderUnsubscribePage({ siteUrl }) {
  const site = String(siteUrl || "").replace(/\/+$/, "");
  const block = (lang) => {
    const copy = UNSUBSCRIBED_PAGE_COPY[lang];
    return `
      <section dir="${copy.dir}" style="margin:0 0 28px 0;">
        <h1 style="margin:0 0 8px 0;font:700 22px/1.3 system-ui,Arial,sans-serif;color:${NAVY};">${escapeHtml(copy.TITLE)}</h1>
        <p style="margin:0 0 12px 0;font:400 15px/1.7 system-ui,Arial,sans-serif;color:${INK};">${escapeHtml(copy.BODY)}</p>
        <a href="${escapeHtml(site || "/")}" style="font:600 14px/1 system-ui,Arial,sans-serif;color:${NAVY};">${escapeHtml(copy.BACK)}</a>
      </section>`;
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Unsubscribed — TruePrice.cash</title>
</head>
<body style="margin:0;background:${PAGE_BG};font-family:system-ui,Arial,sans-serif;">
  <main style="max-width:560px;margin:0 auto;padding:48px 24px;">
    <div style="background:#ffffff;border-radius:10px;padding:28px;border-top:3px solid ${GOLD};">
      <div style="font:700 16px/1 system-ui,Arial,sans-serif;color:${NAVY};margin-bottom:24px;">TruePrice<span style="color:${GOLD};">.cash</span></div>
${block("en")}
${block("ar")}
    </div>
  </main>
</body>
</html>`;
}
