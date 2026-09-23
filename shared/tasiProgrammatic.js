/** Path builders for Arabic TASI pages shared by the server, sitemap, and client. */

import { formatDocumentTitle } from "./seo/pageTitles.js";
import { formatMetaDescription } from "./seo/pageDescriptions.js";

export const UNDERVALUED_PATH = "/ar/tasi/أسهم-أقل-من-قيمتها-العادلة";
export const EARNINGS_CALENDAR_PATH = "/ar/tasi/نتائج-الشركات";

const DISCLAIMER = "الأرقام تقدير للقيمة العادلة من القوائم المالية، وليست توصية بالبيع أو الشراء.";

export function sectorSlug(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function sectorPath(slug) {
  return `/ar/sa-markets/${slug}`;
}

export function comparePairSlug(a, b) {
  const [x, y] = [String(a || "").trim(), String(b || "").trim()].sort((p, q) =>
    p.localeCompare(q, "en", { numeric: true })
  );
  return `${x}-vs-${y}`;
}

export function comparePath(a, b) {
  return `/ar/compare/${comparePairSlug(a, b)}`;
}

export function earningsNotePath(ticker, period) {
  return `/ar/tasi/نتائج/${encodeURIComponent(String(ticker || "").trim())}/${encodeURIComponent(String(period || "").trim())}`;
}

export function parseComparePair(slug) {
  const match = String(slug || "").match(/^(\d+)-vs-(\d+)$/);
  if (!match) return null;
  return { a: match[1], b: match[2], canonical: comparePairSlug(match[1], match[2]) };
}

function finite(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function fmtNumber(value) {
  const n = finite(value);
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function fmtGap(value) {
  const n = finite(value);
  if (n == null) return "—";
  const rounded = Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

/** Companies from tasi_grouped_by_industry.json. First sector wins if a ticker repeats. */
export function catalogFromGrouped(grouped) {
  const companies = [];
  const seen = new Set();
  const slugCount = new Map();
  for (const [sector, list] of Object.entries(grouped || {})) {
    if (!Array.isArray(list)) continue;
    let slug = sectorSlug(sector);
    if (!slug) continue;
    const used = slugCount.get(slug) || 0;
    slugCount.set(slug, used + 1);
    if (used > 0) slug = `${slug}-${used + 1}`;
    for (const item of list) {
      const ticker = String(item?.Ticker ?? item?.ticker ?? "").trim();
      if (!ticker || seen.has(ticker)) continue;
      seen.add(ticker);
      companies.push({
        ticker,
        name: String(item?.Company ?? item?.company ?? ticker).trim() || ticker,
        sector,
        sectorSlug: slug,
      });
    }
  }
  return companies;
}

/** Each name vs the next three tickers in the same sector. */
export function comparePairs(companies) {
  const bySector = new Map();
  for (const company of companies) {
    if (!bySector.has(company.sectorSlug)) bySector.set(company.sectorSlug, []);
    bySector.get(company.sectorSlug).push(company);
  }
  const pairs = [];
  for (const list of bySector.values()) {
    list.sort((a, b) => a.ticker.localeCompare(b.ticker, "en", { numeric: true }));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length && j <= i + 3; j++) {
        pairs.push({
          a: list[i],
          b: list[j],
          slug: comparePairSlug(list[i].ticker, list[j].ticker),
        });
      }
    }
  }
  return pairs;
}

export function commentaryLines(note) {
  if (!note) return [];
  const lines = [
    `رُصدت قوائم ${note.name} (${note.ticker}) للفترة المنتهية في ${note.period}.`,
    `الإيرادات: ${fmtNumber(note.revenue)}`,
    `صافي الدخل: ${fmtNumber(note.netIncome)}`,
    `ربحية السهم: ${fmtNumber(note.eps)}`,
  ];
  if (finite(note.price) != null && finite(note.fairValue) != null) {
    lines.push(
      `السعر ${fmtNumber(note.price)} ر.س والقيمة العادلة ${fmtNumber(note.fairValue)} ر.س، والفجوة ${fmtGap(note.gapPct)}.`
    );
  } else {
    lines.push("السعر أو القيمة العادلة غير متوفرين في ذاكرة السوق لهذه الشركة.");
  }
  lines.push(DISCLAIMER);
  return lines;
}

function arabicMeta(text) {
  let sentence = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  const filler = " الأرقام من قوائم TruePrice.Cash على السوق السعودي، وليست توصية بالبيع أو الشراء.";
  if (sentence.length < 120) sentence = `${sentence}${filler}`;
  if (sentence.length < 120) {
    sentence = `${sentence} قارن السعر بالقيمة العادلة لكل شركة تاسي على TruePrice.Cash.`;
  }
  return formatMetaDescription(sentence);
}

function pageSeo({ title, description, pathname }) {
  return {
    documentTitle: formatDocumentTitle(title, "ar"),
    metaDescription: arabicMeta(description),
    pathname,
    alternates: { ar: pathname, "x-default": pathname },
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      url: pathname,
      inLanguage: "ar",
      description,
    },
  };
}

export function undervaluedSeo() {
  return pageSeo({
    title: "أسهم تاسي أقل من قيمتها العادلة",
    description:
      "أسهم السوق السعودي التي يقل سعرها عن القيمة العادلة المحسوبة على TruePrice.Cash، وتتحدث القائمة عند تحديث بيانات القوائم.",
    pathname: UNDERVALUED_PATH,
  });
}

export function sectorSeo(sectorName, slug) {
  return pageSeo({
    title: `${sectorName} في تاسي`,
    description: `أسهم قطاع ${sectorName} في السوق السعودي مع السعر والقيمة العادلة والفجوة على TruePrice.Cash.`,
    pathname: sectorPath(slug),
  });
}

export function compareSeo(a, b) {
  const pathname = comparePath(a.ticker, b.ticker);
  return pageSeo({
    title: `${a.name} مقابل ${b.name}`,
    description: `مقارنة ${a.name} (${a.ticker}) و${b.name} (${b.ticker}) في قطاع ${a.sector} حسب السعر والقيمة العادلة على TruePrice.Cash.`,
    pathname,
  });
}

export function earningsCalendarSeo() {
  return pageSeo({
    title: "نتائج شركات تاسي",
    description:
      "تقويم نتائج شركات السوق السعودي: كل اسم في تاسي، ورابط تعليق النتائج عند رصد قوائم فترة جديدة على TruePrice.Cash.",
    pathname: EARNINGS_CALENDAR_PATH,
  });
}

export function earningsNoteSeo(note) {
  return pageSeo({
    title: `نتائج ${note.name}`,
    description: commentaryLines(note)[0] || `نتائج ${note.name} (${note.ticker}) للفترة ${note.period}.`,
    pathname: earningsNotePath(note.ticker, note.period),
  });
}

export { DISCLAIMER };
