/**
 * 1200×630 PNG share cards for WhatsApp, X, and Telegram.
 * Drawn on the server so the og:image URL is a real image before any page script runs.
 */
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Resvg } from "@resvg/resvg-js";
import { findStockByTicker, CURRENCY_BY_MARKET } from "./stockCatalogLookup.js";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "../shared/seo/ogPaths.js";

const bundledFont = (name) => join(dirname(fileURLToPath(import.meta.url)), "fonts", name);

const FONT_CANDIDATES = [
  bundledFont("NotoSans-Bold.ttf"),
  bundledFont("NotoSans-Regular.ttf"),
  bundledFont("NotoSansArabic-Bold.ttf"),
  bundledFont("NotoSansArabic-Regular.ttf"),
  "C:/Windows/Fonts/tahomabd.ttf",
  "C:/Windows/Fonts/tahoma.ttf",
  "C:/Windows/Fonts/arialbd.ttf",
  "C:/Windows/Fonts/arial.ttf",
  "C:/Windows/Fonts/segoeuib.ttf",
  "C:/Windows/Fonts/segoeui.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
  "/usr/share/fonts/opentype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/opentype/noto/NotoSansArabic-Bold.ttf",
  "/usr/share/fonts/opentype/noto/NotoSansArabic-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];

const FONT_FAMILY =
  "Tahoma, Arial, Segoe UI, Noto Sans, Noto Sans Arabic, Noto Sans Arabic UI, DejaVu Sans";

let fontFiles = null;

function availableFonts() {
  if (fontFiles) return fontFiles;
  fontFiles = FONT_CANDIDATES.filter((file) => existsSync(file));
  if (!fontFiles.length) {
    console.warn("[og] No TTF fonts found. Share cards will render without text.");
  }
  return fontFiles;
}

function xml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function finite(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value) {
  const n = finite(value);
  if (n == null) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatGap(pct) {
  const n = finite(pct);
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function gapFill(pct) {
  const n = finite(pct);
  if (n == null) return "#9fb0c3";
  return n >= 0 ? "#3dd68c" : "#ff8d80";
}

function fitName(name) {
  const text = String(name || "").replace(/\s+/g, " ").trim();
  if (text.length <= 72) return text;
  return `${text.slice(0, 41).trim()}…`;
}

function nameSize(name) {
  const len = [...String(name || "")].length;
  if (len <= 16) return 64;
  if (len <= 28) return 50;
  return 38;
}

function isArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ""));
}

function textEl({ x, y, size, weight, fill, anchor, rtl, content }) {
  const dir = rtl ? ` direction="rtl" unicode-bidi="plaintext"` : "";
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${FONT_FAMILY}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}"${dir}>${xml(content)}</text>`;
}

function statColumn({ x, label, value, valueFill, rtl }) {
  const anchor = rtl ? "end" : "start";
  const textX = rtl ? x + 292 : x + 28;
  return `
    <rect x="${x}" y="400" width="320" height="150" rx="18" fill="#173152"/>
    ${textEl({ x: textX, y: 452, size: 22, weight: 700, fill: "#8eabc8", anchor, rtl, content: label })}
    ${textEl({ x: textX, y: 512, size: 40, weight: 700, fill: valueFill, anchor, content: value })}
  `;
}

export function renderOgCardPng(card) {
  const locale = card.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";
  const brand = "TruePrice.Cash";
  const ticker = String(card.ticker || "").trim();
  const name = fitName(card.name || ticker || brand);
  const rtlName = isArabic(name);
  const labels = isAr
    ? { price: "السعر", fair: "القيمة العادلة", gap: "الفجوة" }
    : { price: "Price", fair: "Fair value", gap: "Gap" };
  const currency = card.currency ? ` ${card.currency}` : "";
  const priceText = card.price == null ? "—" : `${formatMoney(card.price)}${currency}`;
  const fairText = card.fairValue == null ? "—" : `${formatMoney(card.fairValue)}${currency}`;
  const gapKnown = card.price != null && card.fairValue != null && finite(card.gapPct) != null;
  const gapText = gapKnown ? formatGap(card.gapPct) : "—";
  const kicker = ticker || "US · TASI · Tokyo · LSE";
  const columns = [
    { label: labels.price, value: priceText, valueFill: "#ffffff" },
    { label: labels.fair, value: fairText, valueFill: "#ffffff" },
    { label: labels.gap, value: gapText, valueFill: gapKnown ? gapFill(card.gapPct) : "#9fb0c3" },
  ];
  const columnOrder = isAr ? [2, 1, 0] : [0, 1, 2];
  const columnXs = [72, 424, 776];
  const statsSvg = ticker
    ? columnOrder
        .map((idx, i) => statColumn({ x: columnXs[i], rtl: isAr, ...columns[idx] }))
        .join("")
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <rect width="1200" height="630" fill="#10233f"/>
  <rect width="1200" height="10" fill="#2c7be5"/>
  <circle cx="1110" cy="70" r="120" fill="#173152"/>
  ${textEl({ x: 72, y: 92, size: 28, weight: 700, fill: "#7eb6ff", anchor: "start", content: brand })}
  ${textEl({ x: 72, y: 168, size: 26, weight: 700, fill: "#d6e4f5", anchor: "start", content: kicker })}
  ${textEl({
    x: rtlName ? 1128 : 72,
    y: 280,
    size: nameSize(name),
    weight: 700,
    fill: "#ffffff",
    anchor: rtlName ? "end" : "start",
    rtl: rtlName,
    content: name,
  })}
  ${statsSvg}
</svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_IMAGE_WIDTH },
    font: {
      fontFiles: availableFonts(),
      loadSystemFonts: availableFonts().length === 0,
      defaultFontFamily: "Tahoma",
    },
  });
  return resvg.render().asPng();
}

export function cardFromCatalog({ locale, ticker, screenerStore }) {
  const found = findStockByTicker(ticker);
  if (!found) return null;
  const market = found.market;
  let price = null;
  let fairValue = null;
  let gapPct = null;
  try {
    const items = screenerStore?.read?.(market)?.record?.items || [];
    const want = String(found.hit.ticker).toUpperCase();
    const row = items.find((item) => String(item?.ticker || "").toUpperCase() === want);
    if (row) {
      price = finite(row.priceApprox);
      fairValue = finite(row.fairValue);
      gapPct = finite(row.discountPct);
    }
  } catch {
    /* catalog name still renders */
  }
  return {
    locale: locale === "ar" ? "ar" : "en",
    ticker: found.hit.ticker,
    name: found.hit.name,
    currency: CURRENCY_BY_MARKET[market] || "",
    price,
    fairValue,
    gapPct,
  };
}

const pngCache = new Map();

function cacheGet(key) {
  const hit = pngCache.get(key);
  if (!hit) return null;
  pngCache.delete(key);
  pngCache.set(key, hit);
  return hit;
}

function cacheSet(key, png) {
  pngCache.set(key, png);
  if (pngCache.size > 300) {
    const oldest = pngCache.keys().next().value;
    pngCache.delete(oldest);
  }
}

export function defaultOgPng() {
  const key = "default";
  const cached = cacheGet(key);
  if (cached) return cached;
  const png = renderOgCardPng({
    locale: "en",
    name: "Fair value for US, TASI, Tokyo and London",
  });
  cacheSet(key, png);
  return png;
}

export function stockOgPng({ locale, ticker, screenerStore }) {
  const card = cardFromCatalog({ locale, ticker, screenerStore });
  if (!card) return null;
  const key = [
    card.locale,
    card.ticker,
    card.price == null ? "" : card.price.toFixed(2),
    card.fairValue == null ? "" : card.fairValue.toFixed(2),
    card.gapPct == null ? "" : card.gapPct.toFixed(1),
  ].join("|");
  const cached = cacheGet(key);
  if (cached) return cached;
  const png = renderOgCardPng(card);
  cacheSet(key, png);
  return png;
}

export function sendPng(res, png) {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(png);
}

export const ogRuntime = { screenerStore: null };

export function handleDefaultOg(_req, res) {
  try {
    sendPng(res, defaultOgPng());
  } catch (err) {
    console.error("[og] default card failed:", err?.message || err);
    res.status(500).type("text/plain").send("OG image failed");
  }
}

export function handleStockOg(req, res) {
  const locale = String(req.params.locale || "").toLowerCase();
  let ticker = String(req.params.ticker || "");
  try {
    ticker = decodeURIComponent(ticker);
  } catch {
    return res.status(404).end();
  }
  if ((locale !== "en" && locale !== "ar") || !/^[A-Za-z0-9.]{1,16}$/.test(ticker)) {
    return res.status(404).end();
  }
  try {
    const png = stockOgPng({ locale, ticker, screenerStore: ogRuntime.screenerStore });
    if (!png) return res.status(404).end();
    return sendPng(res, png);
  } catch (err) {
    console.error("[og] stock card failed:", err?.message || err);
    return res.status(500).type("text/plain").send("OG image failed");
  }
}
