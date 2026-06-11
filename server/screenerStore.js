import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { FMP_FINANCIALS_CACHE_MS } from "./fmpFinancialsStore.js";

const _serverDir = dirname(fileURLToPath(import.meta.url));

export const SCREENER_CACHE_MS = FMP_FINANCIALS_CACHE_MS;

const FILE_BY_MARKET = {
  us: "screener_us.json",
  sa: "screener_sa.json",
  jp: "screener_jp.json",
  uk: "screener_uk.json",
};

export const SCREENER_MARKETS = ["us", "sa", "jp", "uk"];

export function resolveScreenerDir() {
  const explicit = (process.env.SCREENER_DATA_DIR || "").trim();
  if (explicit) return explicit;
  const dbPath = (process.env.DB_PATH || "").trim();
  if (dbPath.startsWith("/var/data")) return join("/var/data", "screener");
  return join(_serverDir, "data", "screener");
}

export function createScreenerStore(cacheDir) {
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

  function filePath(market) {
    const name = FILE_BY_MARKET[market];
    if (!name) throw new Error(`Unknown screener market: ${market}`);
    return join(cacheDir, name);
  }

  function read(market) {
    const path = filePath(market);
    if (!existsSync(path)) return null;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      if (!raw || typeof raw !== "object") return null;
      return { path, record: raw };
    } catch {
      return null;
    }
  }

  function isExpired(record) {
    if (!record?.meta?.expiresAt) return true;
    const t = Date.parse(record.meta.expiresAt);
    return !Number.isFinite(t) || Date.now() >= t;
  }

  function write(market, items, extraMeta = {}) {
    const fetchedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SCREENER_CACHE_MS).toISOString();
    const record = {
      meta: {
        market,
        source: "fmp",
        fetchedAt,
        expiresAt,
        count: items.length,
        ...extraMeta,
      },
      items,
    };
    const path = filePath(market);
    writeFileSync(path, JSON.stringify(record), "utf8");
    return { ...record, filePath: path };
  }

  return { read, write, isExpired, cacheDir, filePath };
}
