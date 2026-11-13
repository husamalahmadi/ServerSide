/**
 * Narrative email for changes in stocks a user viewed.
 *
 * Unlike the fair-value digest this is rendered in one language: the reader's last
 * stock page view tells us which one they browse in.
 *
 * HTML here must survive email clients: inline styles, table layout, no external CSS.
 */
import EN from "../src/locales/en.js";
import AR from "../src/locales/ar.js";
import { stockPath } from "../shared/seo/stockPaths.js";

const NAVY = "#0f2233";
const GOLD = "#c9a84c";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const PAGE_BG = "#f4f5f7";
/** Below this, a fair-value move is described as "unchanged" rather than as a tiny %. */
const FLAT_MOVE = 0.01;

const COPY = {
  en: {
    dir: "ltr",
    align: "left",
    locale: "en-US",
    HEADING: "What changed in the stocks you viewed",
    INTRO: "Here is what moved since you last looked. Open a stock to see the full, updated analysis.",
    SINCE_DATE: "Since you last looked at {name} on {date}, ",
    SINCE_PLAIN: "Since you last looked at {name}, ",
    PRICE_UP: "its share price has risen {pct}%, from {from} to {to}.",
    PRICE_DOWN: "its share price has fallen {pct}%, from {from} to {to}.",
    PRICE_FLAT: "its share price is roughly unchanged at {to}.",
    PRICE_NOW: "its share price is now {to}.",
    FV_UP: "Our fair value estimate was revised up {pct}%, from {from} to {to}.",
    FV_DOWN: "Our fair value estimate was revised down {pct}%, from {from} to {to}.",
    FV_FLAT: "Our fair value estimate is unchanged at {to}.",
    FV_NOW: "Our fair value estimate is now {to}.",
    FLIP_UNDER: "That turns the picture around: the stock has gone from overvalued to undervalued, and now trades about {gap}% below our fair value.",
    FLIP_OVER: "That turns the picture around: the stock has gone from undervalued to overvalued, and now trades about {gap}% above our fair value.",
    STILL_UNDER: "It still looks undervalued, trading about {gap}% below our fair value.",
    STILL_OVER: "It still looks overvalued, trading about {gap}% above our fair value.",
    VIEW_STOCK: "See the updated {ticker} analysis",
    SUBJECT_PRICE_UP: "price up {pct}%",
    SUBJECT_PRICE_DOWN: "price down {pct}%",
    SUBJECT_FV_UP: "fair value up {pct}%",
    SUBJECT_FV_DOWN: "fair value down {pct}%",
    SUBJECT_NOW_UNDER: "now undervalued",
    SUBJECT_NOW_OVER: "now overvalued",
    SUBJECT_MORE_ONE: "{first} — plus 1 more stock you viewed",
    SUBJECT_MORE_MANY: "{first} — plus {n} more stocks you viewed",
    METHODOLOGY: "How we calculate fair value",
    ESTIMATE_NOTE: "Fair value is a model-based estimate, not advice.",
    WHY: "You get this email because you viewed these stocks on TruePrice.cash while signed in.",
    MANAGE: "Manage email settings in your profile",
    UNSUBSCRIBE: "Stop emails about stocks I viewed",
    DISCLAIMER: EN.CMA_DISCLAIMER,
  },
  ar: {
    dir: "rtl",
    align: "right",
    locale: "ar",
    HEADING: "ما الذي تغيّر في الأسهم التي اطّلعت عليها",
    INTRO: "إليك ما تغيّر منذ آخر زيارة لك. افتح السهم لترى التحليل الكامل المحدَّث.",
    SINCE_DATE: "منذ آخر مرة اطّلعت فيها على {name} في {date}، ",
    SINCE_PLAIN: "منذ آخر مرة اطّلعت فيها على {name}، ",
    PRICE_UP: "ارتفع سعر السهم بنسبة {pct}%، من {from} إلى {to}.",
    PRICE_DOWN: "انخفض سعر السهم بنسبة {pct}%، من {from} إلى {to}.",
    PRICE_FLAT: "بقي سعر السهم دون تغيير يُذكر عند {to}.",
    PRICE_NOW: "أصبح سعر السهم {to}.",
    FV_UP: "ورفعنا تقديرنا للقيمة العادلة بنسبة {pct}%، من {from} إلى {to}.",
    FV_DOWN: "وخفّضنا تقديرنا للقيمة العادلة بنسبة {pct}%، من {from} إلى {to}.",
    FV_FLAT: "وبقي تقديرنا للقيمة العادلة دون تغيير عند {to}.",
    FV_NOW: "وأصبح تقديرنا للقيمة العادلة {to}.",
    FLIP_UNDER: "وهذا يقلب الصورة: تحوّل السهم من مقوَّم بأعلى من قيمته إلى مقوَّم بأقل منها، ويُتداول الآن بنحو {gap}% دون قيمته العادلة.",
    FLIP_OVER: "وهذا يقلب الصورة: تحوّل السهم من مقوَّم بأقل من قيمته إلى مقوَّم بأعلى منها، ويُتداول الآن بنحو {gap}% فوق قيمته العادلة.",
    STILL_UNDER: "ولا يزال السهم مقوَّماً بأقل من قيمته، إذ يُتداول بنحو {gap}% دون قيمته العادلة.",
    STILL_OVER: "ولا يزال السهم مقوَّماً بأعلى من قيمته، إذ يُتداول بنحو {gap}% فوق قيمته العادلة.",
    VIEW_STOCK: "اطّلع على تحليل {ticker} المحدَّث",
    SUBJECT_PRICE_UP: "ارتفاع السعر {pct}%",
    SUBJECT_PRICE_DOWN: "انخفاض السعر {pct}%",
    SUBJECT_FV_UP: "ارتفاع القيمة العادلة {pct}%",
    SUBJECT_FV_DOWN: "انخفاض القيمة العادلة {pct}%",
    SUBJECT_NOW_UNDER: "أصبح مقوَّماً بأقل من قيمته",
    SUBJECT_NOW_OVER: "أصبح مقوَّماً بأعلى من قيمته",
    SUBJECT_MORE_ONE: "{first} — وسهم آخر اطّلعت عليه",
    SUBJECT_MORE_MANY: "{first} — و{n} أسهم أخرى اطّلعت عليها",
    METHODOLOGY: "كيف نحسب القيمة العادلة",
    ESTIMATE_NOTE: "القيمة العادلة تقدير مبني على نموذج حسابي وليست نصيحة استثمارية.",
    WHY: "تصلك هذه الرسالة لأنك اطّلعت على هذه الأسهم في TruePrice.cash وأنت مسجّل الدخول.",
    MANAGE: "إدارة إعدادات البريد من ملفك الشخصي",
    UNSUBSCRIBE: "إيقاف رسائل الأسهم التي اطّلعت عليها",
    DISCLAIMER: AR.CMA_DISCLAIMER,
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

function finite(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function money(n, currency) {
  const x = finite(n);
  if (x == null) return null;
  const s = x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${s} ${currency}` : s;
}

function pct(fraction) {
  return (Math.abs(fraction) * 100).toFixed(1);
}

function displayName(change) {
  return change.name ? `${change.name} (${change.ticker})` : change.ticker;
}

function formatDate(iso, copy) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString(copy.locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    numberingSystem: "latn",
  });
}

function priceSentence(c, copy) {
  const to = money(c.priceTo, c.currency);
  if (!to) return null;
  const from = money(c.priceFrom, c.currency);
  const move = finite(c.priceMove);
  if (!from || move == null) return fill(copy.PRICE_NOW, { to });
  if (Math.abs(move) < FLAT_MOVE) return fill(copy.PRICE_FLAT, { to });
  return fill(move > 0 ? copy.PRICE_UP : copy.PRICE_DOWN, { pct: pct(move), from, to });
}

function fairValueSentence(c, copy) {
  const to = money(c.fvTo, c.currency);
  if (!to) return null;
  const from = money(c.fvFrom, c.currency);
  const move = finite(c.fvMove);
  if (!from || move == null) return fill(copy.FV_NOW, { to });
  if (Math.abs(move) < FLAT_MOVE) return fill(copy.FV_FLAT, { to });
  return fill(move > 0 ? copy.FV_UP : copy.FV_DOWN, { pct: pct(move), from, to });
}

function verdictSentence(c, copy) {
  const price = finite(c.priceTo);
  const fv = finite(c.fvTo);
  if (!c.verdictNow || price == null || fv == null || fv <= 0) return null;
  const gap = pct((price - fv) / fv);
  if (c.flipped) return fill(c.verdictNow === "undervalued" ? copy.FLIP_UNDER : copy.FLIP_OVER, { gap });
  return fill(c.verdictNow === "undervalued" ? copy.STILL_UNDER : copy.STILL_OVER, { gap });
}

/** The paragraph for one stock: when, what the price did, what fair value did, what it means. */
export function stockChangeNarrative(change, lang = "en") {
  const copy = COPY[lang] || COPY.en;
  const date = formatDate(change.since, copy);
  const opening = fill(date ? copy.SINCE_DATE : copy.SINCE_PLAIN, { name: displayName(change), date });
  const price = priceSentence(change, copy);
  const fv = fairValueSentence(change, copy);
  const verdict = verdictSentence(change, copy);
  if (price) return [opening + price, fv, verdict].filter(Boolean).join(" ");
  if (!fv) return [opening.replace(/[,،]\s*$/, "."), verdict].filter(Boolean).join(" ");
  // The fair-value sentence becomes the main clause: "…, our fair value…" / "…، رفعنا…".
  const clause = lang === "ar" ? fv.replace(/^و/, "") : fv.charAt(0).toLowerCase() + fv.slice(1);
  return [opening + clause, verdict].filter(Boolean).join(" ");
}

/** "AAPL: price up 7.2%, now overvalued" — the most important change first. */
function headlineFor(change, copy) {
  const parts = [];
  if (change.flipped && change.verdictNow) {
    parts.push(change.verdictNow === "undervalued" ? copy.SUBJECT_NOW_UNDER : copy.SUBJECT_NOW_OVER);
  }
  const pm = finite(change.priceMove);
  if (change.priceMoved && pm != null) {
    parts.push(fill(pm > 0 ? copy.SUBJECT_PRICE_UP : copy.SUBJECT_PRICE_DOWN, { pct: pct(pm) }));
  }
  const fm = finite(change.fvMove);
  if (change.fvMoved && fm != null) {
    parts.push(fill(fm > 0 ? copy.SUBJECT_FV_UP : copy.SUBJECT_FV_DOWN, { pct: pct(fm) }));
  }
  const sep = copy.dir === "rtl" ? "، " : ", ";
  return `${displayName(change)}: ${parts.join(sep)}`;
}

/** Ranks changes so the subject leads with the most newsworthy one. */
function weight(change) {
  const pm = Math.abs(finite(change.priceMove) || 0);
  const fm = Math.abs(finite(change.fvMove) || 0);
  return (change.flipped ? 1 : 0) + Math.max(pm, fm);
}

export function stockAlertSubject(changes, lang = "en") {
  const copy = COPY[lang] || COPY.en;
  const ordered = [...changes].sort((a, b) => weight(b) - weight(a));
  const first = headlineFor(ordered[0], copy);
  const more = ordered.length - 1;
  if (more <= 0) return first;
  return fill(more === 1 ? copy.SUBJECT_MORE_ONE : copy.SUBJECT_MORE_MANY, { first, n: more });
}

function changeBlockHtml(change, copy, lang, siteUrl) {
  const url = `${siteUrl}${stockPath(lang, change.ticker)}`;
  return `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid ${LINE};" dir="${copy.dir}" align="${copy.align}">
            <div style="font:700 16px/1.4 Arial,Helvetica,sans-serif;color:${NAVY};">${escapeHtml(displayName(change))}</div>
            <p style="margin:6px 0 0 0;font:400 14px/1.7 Arial,Helvetica,sans-serif;color:${INK};">${escapeHtml(stockChangeNarrative(change, lang))}</p>
            <div style="margin-top:10px;">
              <a href="${escapeHtml(url)}" style="font:600 13px/1 Arial,Helvetica,sans-serif;color:${NAVY};text-decoration:underline;">${escapeHtml(fill(copy.VIEW_STOCK, { ticker: change.ticker }))}</a>
            </div>
          </td>
        </tr>`;
}

/**
 * @param {{ lang: "en"|"ar", changes: object[], siteUrl: string, unsubscribeUrl: string }} args
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildStockAlertEmail({ lang, changes, siteUrl, unsubscribeUrl }) {
  const copy = COPY[lang] || COPY.en;
  const site = String(siteUrl || "").replace(/\/+$/, "");
  const list = (changes || []).filter((c) => c?.ticker);
  const subject = stockAlertSubject(list, lang);
  const profileUrl = `${site}/profile`;

  const html = `<!doctype html>
<html lang="${lang}" dir="${copy.dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAGE_BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="background:${NAVY};padding:20px 28px;border-bottom:3px solid ${GOLD};" dir="ltr">
              <span style="font:700 18px/1 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:0.02em;">TruePrice<span style="color:${GOLD};">.cash</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0 28px;" dir="${copy.dir}" align="${copy.align}">
              <h1 style="margin:0;font:700 20px/1.3 Arial,Helvetica,sans-serif;color:${NAVY};">${escapeHtml(copy.HEADING)}</h1>
              <p style="margin:8px 0 0 0;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">${escapeHtml(copy.INTRO)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 20px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${list
                .map((c) => changeBlockHtml(c, copy, lang, site))
                .join("")}
              </table>
              <div style="margin-top:16px;" dir="${copy.dir}" align="${copy.align}">
                <a href="${escapeHtml(`${site}/methodology`)}" style="font:600 13px/1 Arial,Helvetica,sans-serif;color:${NAVY};text-decoration:underline;">${escapeHtml(copy.METHODOLOGY)}</a>
              </div>
              <p style="margin:12px 0 0 0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};" dir="${copy.dir}" align="${copy.align}">${escapeHtml(copy.ESTIMATE_NOTE)}</p>
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa;border-top:1px solid ${LINE};padding:18px 28px;" dir="${copy.dir}" align="${copy.align}">
              <p style="margin:0 0 10px 0;font:400 11px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">${escapeHtml(copy.WHY)}</p>
              <p style="margin:0 0 10px 0;font:400 11px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">${escapeHtml(copy.DISCLAIMER)}</p>
              <p style="margin:0 0 16px 0;font:400 11px/1.8 Arial,Helvetica,sans-serif;">
                <a href="${escapeHtml(profileUrl)}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(copy.MANAGE)}</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(copy.UNSUBSCRIBE)}</a>
              </p>
              <p style="margin:0;font:400 11px/1 Arial,Helvetica,sans-serif;color:${MUTED};" align="center">© TruePrice.cash</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const lines = [copy.HEADING, copy.INTRO, ""];
  for (const c of list) {
    lines.push(displayName(c), stockChangeNarrative(c, lang), `${site}${stockPath(lang, c.ticker)}`, "");
  }
  lines.push(
    `${copy.METHODOLOGY}: ${site}/methodology`,
    copy.ESTIMATE_NOTE,
    "",
    copy.WHY,
    copy.DISCLAIMER,
    "",
    `${copy.MANAGE}: ${profileUrl}`,
    `${copy.UNSUBSCRIBE}: ${unsubscribeUrl}`
  );

  return { subject, html, text: lines.join("\n") };
}
