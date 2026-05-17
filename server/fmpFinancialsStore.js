import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const _serverDir = dirname(fileURLToPath(import.meta.url));

export function resolveFmpFinancialsDir() {
  const explicit = (process.env.FMP_FINANCIALS_DIR || "").trim();
  if (explicit) return explicit;
  const dbPath = (process.env.DB_PATH || "").trim();
  if (dbPath.startsWith("/var/data")) return join("/var/data", "fmp-financials");
  return join(_serverDir, "data", "fmp-financials");
}

/** @typedef {{ symbol: string, companyName?: string|null, fetchedAt: string, expiresAt: string, income: object[], balance: object[], cash: object[], enterpriseValues: object[], source?: string }} FinancialsCacheRecord */

export const FMP_FINANCIALS_CACHE_MS = 90 * 24 * 60 * 60 * 1000; // 3 months

export const INCOMPLETE_DATA_CODE = "INCOMPLETE_DATA";

const CRITICAL_INCOME_FIELDS = ["revenue", "netIncome"];
const CRITICAL_BALANCE_FIELDS = ["totalStockholdersEquity", "totalEquity"];
const CRITICAL_EV_FIELDS = ["numberOfShares", "enterpriseValue"];

function isMissingApiValue(v) {
  return v === null || v === undefined;
}

function sanitizeFilePart(s) {
  return String(s || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

/**
 * Disk filename: CompanyName_SYMBOL.json (symbol always included for uniqueness).
 */
export function cacheFileName(symbol, companyName) {
  const sym = sanitizeFilePart(symbol) || "unknown";
  const name = sanitizeFilePart(companyName);
  const base = name && name.toLowerCase() !== sym.toLowerCase() ? `${name}_${sym}` : sym;
  return `${base}.json`;
}

export function createFinancialsStore(cacheDir) {
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

  function filePath(symbol, companyName) {
    return join(cacheDir, cacheFileName(symbol, companyName));
  }

  /** Find cached file by symbol (scans *_SYMBOL.json and SYMBOL.json). */
  function findRecordPath(symbol) {
    const sym = sanitizeFilePart(symbol);
    if (!sym) return null;
    const exact = join(cacheDir, `${sym}.json`);
    if (existsSync(exact)) return exact;
    const suffix = `_${sym}.json`;
    try {
      for (const name of readdirSync(cacheDir)) {
        if (name.endsWith(suffix) || name === `${sym}.json`) {
          return join(cacheDir, name);
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function readRecord(symbol) {
    const path = findRecordPath(symbol);
    if (!path) return null;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      if (!raw || typeof raw !== "object") return null;
      return { path, record: raw };
    } catch {
      return null;
    }
  }

  function isExpired(record) {
    if (!record?.expiresAt) return true;
    const t = Date.parse(record.expiresAt);
    return !Number.isFinite(t) || Date.now() >= t;
  }

  function writeRecord(symbol, companyName, payload) {
    const fetchedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + FMP_FINANCIALS_CACHE_MS).toISOString();
    const record = {
      symbol,
      companyName: companyName ?? null,
      fetchedAt,
      expiresAt,
      income: payload.income || [],
      balance: payload.balance || [],
      cash: payload.cash || [],
      enterpriseValues: payload.enterpriseValues || [],
    };
    const path = filePath(symbol, companyName);
    const existing = findRecordPath(symbol);
    if (existing && existing !== path) {
      try {
        unlinkSync(existing);
      } catch {
        /* ignore */
      }
    }
    writeFileSync(path, JSON.stringify(record, null, 2), "utf8");
    return { ...record, source: "disk", filePath: path };
  }

  function toResponse(record, source) {
    return {
      symbol: record.symbol,
      companyName: record.companyName ?? null,
      fetchedAt: record.fetchedAt,
      expiresAt: record.expiresAt,
      source: source || record.source || "disk",
      income: record.income || [],
      balance: record.balance || [],
      cash: record.cash || [],
      enterpriseValues: record.enterpriseValues || [],
    };
  }

  return { readRecord, isExpired, writeRecord, toResponse, cacheDir, findRecordPath };
}

/**
 * Detect incomplete FMP responses (null/missing/empty endpoints), not legitimate accounting zeros.
 */
export function validateFmpFinancialsBundle(bundle) {
  const issues = [];
  const income = bundle?.income || [];
  const balance = bundle?.balance || [];
  const cash = bundle?.cash || [];
  const ev = bundle?.enterpriseValues || [];

  if (!income.length) issues.push("income_statement_empty");
  if (!balance.length) issues.push("balance_sheet_empty");
  if (!cash.length) issues.push("cash_flow_empty");
  if (!ev.length) issues.push("enterprise_values_empty");

  const is0 = income[0];
  if (is0) {
    const missingCritical = CRITICAL_INCOME_FIELDS.filter((f) => isMissingApiValue(is0[f]));
    if (missingCritical.length === CRITICAL_INCOME_FIELDS.length) {
      issues.push("income_latest_critical_missing");
    }
    if (income.length >= 2) {
      const prevRev = Number(income[1]?.revenue);
      const latestRev = Number(is0.revenue);
      if (Number.isFinite(prevRev) && prevRev > 0 && latestRev === 0 && !isMissingApiValue(is0.revenue)) {
        issues.push("revenue_latest_zero_after_prior_year");
      }
    }
  }

  const bs0 = balance[0];
  if (bs0) {
    const hasEquity = CRITICAL_BALANCE_FIELDS.some((f) => {
      const v = bs0[f];
      return !isMissingApiValue(v) && Number(v) !== 0;
    });
    if (!hasEquity && CRITICAL_BALANCE_FIELDS.every((f) => isMissingApiValue(bs0[f]))) {
      issues.push("equity_latest_missing");
    }
  }

  const ev0 = ev[0];
  if (ev0) {
    for (const f of CRITICAL_EV_FIELDS) {
      if (isMissingApiValue(ev0[f])) issues.push(`enterprise_${f}_missing`);
    }
    const shares = Number(ev0.numberOfShares);
    if (!Number.isFinite(shares) || shares <= 0) {
      issues.push("enterprise_shares_invalid");
    }
  }

  const endpointCount = [income.length, balance.length, cash.length, ev.length].filter((n) => n > 0).length;
  if (endpointCount > 0 && endpointCount < 4) {
    issues.push("partial_statement_data");
  }

  return {
    ok: issues.length === 0,
    issues: [...new Set(issues)],
  };
}

export const INCOMPLETE_USER_MESSAGE =
  "Some financial data could not be loaded completely. This is usually temporary — please try again in a moment.";
