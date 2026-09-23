import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { loadGroupedCatalog } from "./buildScreenerFromFmp.js";
import { fetchFmpFinancialsBundle, fmpApiKey, FMP_STABLE_BASE } from "./fmpFetch.js";
import { resolveFmpFinancialsDir } from "./fmpFinancialsStore.js";
import { stockPath } from "../shared/seo/stockPaths.js";
import { stockOgImagePath } from "../shared/seo/ogPaths.js";
import {
  UNDERVALUED_PATH,
  EARNINGS_CALENDAR_PATH,
  catalogFromGrouped,
  commentaryLines,
  comparePairSlug,
  comparePath,
  compareSeo,
  earningsCalendarSeo,
  earningsNotePath,
  earningsNoteSeo,
  fmtGap,
  fmtNumber,
  parseComparePair,
  sectorPath,
  sectorSeo,
  undervaluedSeo,
  DISCLAIMER,
} from "../shared/tasiProgrammatic.js";

function finite(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizePath(pathname) {
  const raw = String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function commentaryFilePath() {
  const explicit = (process.env.EARNINGS_COMMENTARY_PATH || "").trim();
  if (explicit) return explicit;
  return join(dirname(resolveFmpFinancialsDir()), "earnings-commentary.json");
}

function loadNotes() {
  const file = commentaryFilePath();
  try {
    if (!existsSync(file)) return {};
    const data = JSON.parse(readFileSync(file, "utf8"));
    return data?.notes && typeof data.notes === "object" ? data.notes : {};
  } catch {
    return {};
  }
}

function saveNotes(notes) {
  const file = commentaryFilePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ notes }, null, 2));
}

function latestNoteFor(notes, ticker) {
  let best = null;
  for (const note of Object.values(notes)) {
    if (note?.ticker !== ticker) continue;
    if (!best || String(note.period) > String(best.period)) best = note;
  }
  return best;
}

function statementFromRecord(record) {
  const row = Array.isArray(record?.income) ? record.income[0] : null;
  if (!row) return null;
  const period = String(row.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) return null;
  return {
    period,
    revenue: finite(row.revenue),
    netIncome: finite(row.netIncome),
    eps: finite(row.eps ?? row.epsdiluted),
  };
}

export function createTasiProgram({ screenerStore, financialsStore, siteUrl }) {
  let catalogCache = null;

  function catalog() {
    if (catalogCache) return catalogCache;
    const entries = loadGroupedCatalog("sa").map((entry) => ({
      Ticker: entry.ticker,
      Company: entry.name,
      sector: entry.sector,
    }));
    const grouped = {};
    for (const entry of entries) {
      if (!grouped[entry.sector]) grouped[entry.sector] = [];
      grouped[entry.sector].push({ Ticker: entry.Ticker, Company: entry.Company });
    }
    catalogCache = catalogFromGrouped(grouped);
    return catalogCache;
  }

  function updatedAt() {
    return screenerStore.read("sa")?.record?.meta?.fetchedAt || null;
  }

  function rows() {
    const metrics = new Map(
      (screenerStore.read("sa")?.record?.items || []).map((row) => [String(row.ticker), row])
    );
    return catalog().map((company) => {
      const metric = metrics.get(company.ticker) || {};
      return {
        ...company,
        name: metric.name || company.name,
        price: finite(metric.priceApprox),
        fairValue: finite(metric.fairValue),
        gapPct: finite(metric.discountPct) == null ? null : Math.round(Number(metric.discountPct) * 10) / 10,
        marketCap: finite(metric.marketCap),
      };
    });
  }

  function rowByTicker(ticker) {
    return rows().find((row) => row.ticker === String(ticker)) || null;
  }

  function undervaluedPayload() {
    const list = rows()
      .filter((row) => row.gapPct != null && row.gapPct > 0 && row.price != null && row.fairValue != null)
      .sort((a, b) => b.gapPct - a.gapPct || String(a.ticker).localeCompare(String(b.ticker), "en", { numeric: true }));
    const sectors = [];
    const seen = new Set();
    for (const row of rows()) {
      if (seen.has(row.sectorSlug)) continue;
      seen.add(row.sectorSlug);
      sectors.push({ slug: row.sectorSlug, name: row.sector, path: sectorPath(row.sectorSlug) });
    }
    return { updatedAt: updatedAt(), rows: list, sectors, path: UNDERVALUED_PATH };
  }

  function sectorPayload(slug) {
    const list = rows().filter((row) => row.sectorSlug === slug);
    if (!list.length) return null;
    list.sort((a, b) => {
      if (a.gapPct == null && b.gapPct == null) return a.ticker.localeCompare(b.ticker, "en", { numeric: true });
      if (a.gapPct == null) return 1;
      if (b.gapPct == null) return -1;
      return b.gapPct - a.gapPct;
    });
    return { updatedAt: updatedAt(), sector: list[0].sector, slug, path: sectorPath(slug), rows: list };
  }

  function comparePayload(slug) {
    const parsed = parseComparePair(slug);
    if (!parsed) return null;
    const a = rowByTicker(parsed.a);
    const b = rowByTicker(parsed.b);
    if (!a || !b) return null;
    if (a.sectorSlug !== b.sectorSlug) return { error: "different_sector" };
    return {
      updatedAt: updatedAt(),
      sector: a.sector,
      sectorPath: sectorPath(a.sectorSlug),
      path: comparePath(a.ticker, b.ticker),
      a,
      b,
    };
  }

  function earningsPayload() {
    const notes = loadNotes();
    const list = rows()
      .map((row) => {
        const note = latestNoteFor(notes, row.ticker);
        return {
          ticker: row.ticker,
          name: row.name,
          sector: row.sector,
          sectorSlug: row.sectorSlug,
          note: note
            ? { period: note.period, path: earningsNotePath(note.ticker, note.period) }
            : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return { updatedAt: updatedAt(), path: EARNINGS_CALENDAR_PATH, rows: list };
  }

  function notePayload(ticker, period) {
    const key = `${String(ticker)}:${String(period)}`;
    const note = loadNotes()[key];
    if (!note) return null;
    return { note, lines: commentaryLines(note), path: earningsNotePath(note.ticker, note.period) };
  }

  function valuationSnapshot(ticker) {
    const row = rowByTicker(ticker);
    if (!row) return { price: null, fairValue: null, gapPct: null, name: ticker, sector: "", sectorSlug: "" };
    return row;
  }

  function upsertNote(notes, draft) {
    if (!draft?.ticker || !/^\d{4}-\d{2}-\d{2}$/.test(String(draft.period || ""))) return false;
    if (draft.revenue == null && draft.netIncome == null && draft.eps == null) return false;
    const key = `${draft.ticker}:${draft.period}`;
    if (notes[key]) return false;
    const snap = valuationSnapshot(draft.ticker);
    notes[key] = {
      ticker: draft.ticker,
      name: snap.name || draft.name || draft.ticker,
      sector: snap.sector || "",
      sectorSlug: snap.sectorSlug || "",
      period: draft.period,
      announcedOn: draft.announcedOn || new Date().toISOString().slice(0, 10),
      revenue: draft.revenue ?? null,
      netIncome: draft.netIncome ?? null,
      eps: draft.eps ?? null,
      price: snap.price,
      fairValue: snap.fairValue,
      gapPct: snap.gapPct,
      source: draft.source,
      publishedAt: new Date().toISOString(),
    };
    return true;
  }

  async function refreshSymbol(symbol) {
    const key = fmpApiKey();
    if (!key || !financialsStore) return null;
    try {
      const bundle = await fetchFmpFinancialsBundle(symbol, key);
      if (bundle.fetchErrors?.length) return null;
      financialsStore.writeRecord(symbol, bundle.companyName, bundle);
      return financialsStore.readRecord(symbol)?.record || null;
    } catch (err) {
      console.warn("[tasi/earnings] refresh failed:", symbol, err?.message || err);
      return null;
    }
  }

  async function fetchEarningsWindow(apiKey) {
    const today = new Date();
    const from = new Date(today.getTime() - 2 * 86400000).toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
    const url = `${FMP_STABLE_BASE}/earnings-calendar?${new URLSearchParams({ from, to, apikey: apiKey })}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter((row) => String(row?.symbol || "").toUpperCase().endsWith(".SR"));
  }

  async function publishEarnings() {
    const notes = loadNotes();
    let published = 0;
    let refreshed = 0;
    const key = fmpApiKey();
    if (key) {
      let windowRows = [];
      try {
        windowRows = await fetchEarningsWindow(key);
      } catch (err) {
        console.warn("[tasi/earnings] calendar fetch failed:", err?.message || err);
      }
      for (const row of windowRows) {
        if (refreshed >= 12) break;
        const ticker = String(row.symbol || "").replace(/\.SR$/i, "");
        const period = String(row.fiscalDateEnding || row.date || "").slice(0, 10);
        if (!ticker || notes[`${ticker}:${period}`]) continue;
        const record = await refreshSymbol(`${ticker}.SR`);
        refreshed += 1;
        const statement = statementFromRecord(record);
        const draft = statement && statement.period === period
          ? { ...statement, ticker, name: row.symbol, announcedOn: String(row.date || "").slice(0, 10), source: "statements" }
          : {
              ticker,
              name: row.symbol,
              period,
              announcedOn: String(row.date || "").slice(0, 10),
              revenue: finite(row.revenue),
              netIncome: null,
              eps: finite(row.eps),
              source: "fmp-calendar",
            };
        if (upsertNote(notes, draft)) published += 1;
      }
    }

    if (financialsStore) {
      for (const company of catalog()) {
        const record = financialsStore.readRecord(`${company.ticker}.SR`)?.record;
        const statement = statementFromRecord(record);
        if (!statement) continue;
        if (upsertNote(notes, { ...statement, ticker: company.ticker, name: company.name, source: "statements" })) {
          published += 1;
        }
      }
    }

    if (published) saveNotes(notes);
    return { ok: true, published, refreshed };
  }

  function dailyGapPost() {
    const origin = String(siteUrl || "https://trueprice.cash").replace(/\/+$/, "");
    const ranked = rows()
      .filter((row) => row.gapPct != null && row.price != null && row.fairValue != null)
      .sort((a, b) => b.gapPct - a.gapPct || (b.marketCap || 0) - (a.marketCap || 0));
    const top = ranked[0];
    if (!top) return { ok: false, reason: "no_priced_tasi_rows" };
    const pageUrl = `${origin}${stockPath("ar", top.ticker)}`;
    const imagePath = stockOgImagePath("ar", top.ticker);
    const imageUrl = `${origin}${imagePath}`;
    const caption = `أكبر فجوة قيمة عادلة في تاسي: ${top.name} (${top.ticker}) يتداول بفارق ${fmtGap(top.gapPct)} عن القيمة العادلة.`;
    const xText = `${caption}\n${pageUrl}`.slice(0, 280);
    return {
      ok: true,
      ticker: top.ticker,
      name: top.name,
      gapPct: top.gapPct,
      pageUrl,
      imageUrl,
      caption,
      xText,
      groupCard: { imageUrl, caption },
    };
  }

  async function distributeDaily() {
    const post = dailyGapPost();
    if (!post.ok) return { ...post, posted: [] };
    const posted = [];
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
    if (token && chatId) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, photo: post.imageUrl, caption: post.caption }),
        });
        posted.push({ channel: "telegram", ok: res.ok, status: res.status });
      } catch (err) {
        posted.push({ channel: "telegram", ok: false, error: err?.message || "telegram_failed" });
      }
    }
    const xToken = (process.env.X_USER_ACCESS_TOKEN || "").trim();
    if (xToken) {
      try {
        const res = await fetch("https://api.twitter.com/2/tweets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${xToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: post.xText }),
        });
        posted.push({ channel: "x", ok: res.ok, status: res.status });
      } catch (err) {
        posted.push({ channel: "x", ok: false, error: err?.message || "x_failed" });
      }
    }
    return { ...post, posted };
  }

  function match(pathname) {
    const path = normalizePath(pathname);
    if (path === UNDERVALUED_PATH) return { kind: "undervalued" };
    if (path === EARNINGS_CALENDAR_PATH) return { kind: "earnings" };
    const note = path.match(/^\/ar\/tasi\/نتائج\/([^/]+)\/([^/]+)$/);
    if (note) return { kind: "note", ticker: note[1], period: note[2] };
    const sector = path.match(/^\/ar\/sa-markets\/([^/]+)$/);
    if (sector) return { kind: "sector", slug: sector[1] };
    const compare = path.match(/^\/ar\/compare\/(\d+-vs-\d+)$/);
    if (compare) return { kind: "compare", slug: compare[1] };
    return null;
  }

  function maybeRedirect(req, res) {
    const path = normalizePath(req.path);
    const compare = path.match(/^\/ar\/compare\/(\d+)-vs-(\d+)$/);
    if (!compare) return false;
    const canonical = `/ar/compare/${comparePairSlug(compare[1], compare[2])}`;
    if (path === canonical) return false;
    res.redirect(301, canonical);
    return true;
  }

  function tableHtml(headers, bodyRows) {
    const head = headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
    const body = bodyRows
      .map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("");
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function stockLink(row) {
    const href = stockPath("ar", row.ticker);
    return `<a href="${escapeHtml(href)}">${escapeHtml(row.name)} (${escapeHtml(row.ticker)})</a>`;
  }

  function fallbackFor(kind, data) {
    if (kind === "undervalued") {
      const body = (data.rows || []).map((row) => [
        stockLink(row),
        escapeHtml(fmtNumber(row.price)),
        escapeHtml(fmtNumber(row.fairValue)),
        escapeHtml(fmtGap(row.gapPct)),
      ]);
      const sectors = (data.sectors || [])
        .map((sector) => `<a href="${escapeHtml(sector.path)}">${escapeHtml(sector.name)}</a>`)
        .join(" · ");
      return wrapFallback(
        "أسهم تاسي أقل من قيمتها العادلة",
        `${tableHtml(["الشركة", "السعر", "القيمة العادلة", "الفجوة"], body)}<p>${sectors}</p>`
      );
    }
    if (kind === "sector") {
      const body = (data.rows || []).map((row) => [
        stockLink(row),
        escapeHtml(fmtNumber(row.price)),
        escapeHtml(fmtNumber(row.fairValue)),
        escapeHtml(fmtGap(row.gapPct)),
      ]);
      return wrapFallback(data.sector, tableHtml(["الشركة", "السعر", "القيمة العادلة", "الفجوة"], body));
    }
    if (kind === "compare") {
      const block = (row) =>
        `<h2>${stockLink(row)}</h2><p>السعر ${escapeHtml(fmtNumber(row.price))} · القيمة العادلة ${escapeHtml(fmtNumber(row.fairValue))} · الفجوة ${escapeHtml(fmtGap(row.gapPct))}</p>`;
      return wrapFallback(`${data.a.name} مقابل ${data.b.name}`, `${block(data.a)}${block(data.b)}`);
    }
    if (kind === "earnings") {
      const body = (data.rows || []).map((row) => [
        stockLink(row),
        `<a href="${escapeHtml(sectorPath(row.sectorSlug))}">${escapeHtml(row.sector)}</a>`,
        row.note
          ? `<a href="${escapeHtml(row.note.path)}">${escapeHtml(row.note.period)}</a>`
          : "بانتظار النتائج",
      ]);
      return wrapFallback("نتائج شركات تاسي", tableHtml(["الشركة", "القطاع", "آخر تعليق"], body));
    }
    if (kind === "note") {
      const lines = (data.lines || []).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
      return wrapFallback(`نتائج ${data.note.name}`, lines);
    }
    return "";
  }

  function wrapFallback(title, inner) {
    return `<main id="tp-static-fallback" class="tp-static-shell" dir="rtl" lang="ar" aria-hidden="true"><h1>${escapeHtml(title)}</h1>${inner}<p>${escapeHtml(DISCLAIMER)}</p></main>`;
  }

  function seoInject(req) {
    const matched = match(req.path);
    if (!matched) return null;
    try {
      if (matched.kind === "undervalued") {
        const data = undervaluedPayload();
        return { seo: undervaluedSeo(), staticFallbackHtml: fallbackFor("undervalued", data) };
      }
      if (matched.kind === "sector") {
        const data = sectorPayload(matched.slug);
        if (!data) return null;
        return { seo: sectorSeo(data.sector, data.slug), staticFallbackHtml: fallbackFor("sector", data) };
      }
      if (matched.kind === "compare") {
        const data = comparePayload(matched.slug);
        if (!data || data.error) return null;
        return { seo: compareSeo(data.a, data.b), staticFallbackHtml: fallbackFor("compare", data) };
      }
      if (matched.kind === "earnings") {
        const data = earningsPayload();
        return { seo: earningsCalendarSeo(), staticFallbackHtml: fallbackFor("earnings", data) };
      }
      if (matched.kind === "note") {
        const data = notePayload(matched.ticker, matched.period);
        if (!data) return null;
        return { seo: earningsNoteSeo(data.note), staticFallbackHtml: fallbackFor("note", data) };
      }
    } catch (err) {
      console.warn("[tasi] SEO inject failed:", err?.message || err);
    }
    return null;
  }

  return {
    register(app, requireInternalToken) {
      const send = (res, body, status = 200) => {
        res.setHeader("Cache-Control", "public, max-age=600");
        res.status(status).json(body);
      };
      app.get("/api/tasi/undervalued", (_req, res) => send(res, undervaluedPayload()));
      app.get("/api/tasi/sectors/:slug", (req, res) => {
        const data = sectorPayload(decodeParam(req.params.slug));
        if (!data) return res.status(404).json({ error: "not_found" });
        return send(res, data);
      });
      app.get("/api/tasi/compare/:pair", (req, res) => {
        const data = comparePayload(req.params.pair);
        if (!data) return res.status(404).json({ error: "not_found" });
        if (data.error) return res.status(404).json({ error: data.error });
        return send(res, data);
      });
      app.get("/api/tasi/earnings", (_req, res) => send(res, earningsPayload()));
      app.get("/api/tasi/earnings/:ticker/:period", (req, res) => {
        const data = notePayload(req.params.ticker, req.params.period);
        if (!data) return res.status(404).json({ error: "not_found" });
        return send(res, data);
      });
      app.post("/api/internal/publish-earnings", requireInternalToken, (_req, res) => {
        res.status(202).json({ ok: true, started: true });
        void publishEarnings()
          .then((result) => console.log("[tasi/earnings] published", result.published))
          .catch((err) => console.error("[tasi/earnings] failed:", err?.message || err));
      });
      app.post("/api/internal/daily-gap-post", requireInternalToken, async (_req, res) => {
        try {
          const result = await distributeDaily();
          res.status(200).json(result);
        } catch (err) {
          console.error("[tasi/distribute] failed:", err?.message || err);
          res.status(500).json({ error: "distribute_failed" });
        }
      });
    },
    seoInject,
    maybeRedirect,
    catalog,
    publishEarnings,
    dailyGapPost,
  };
}

function decodeParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
