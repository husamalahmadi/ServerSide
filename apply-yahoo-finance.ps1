# apply-yahoo-finance.ps1
# Run this from the ROOT of your project (where package.json lives).
# PowerShell: right-click the file -> "Run with PowerShell"
# Or from terminal: .\apply-yahoo-finance.ps1
#
# What this script does:
#   1. Creates  src/services/yahooFinance.js          (new file)
#   2. Replaces src/services/priceService.js           (swap TwelveData -> Yahoo)
#   3. Patches  server/server.js                       (adds 2 proxy routes)
#   4. Patches  src/routes/Stock.jsx                   (swaps logo/profile fetch)
#
# Nothing else is touched. Run from the repo root.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Get-Location

function Assert-File($path) {
    if (-not (Test-Path $path)) {
        Write-Error "ERROR: Expected file not found: $path`nMake sure you are running this script from the project root."
        exit 1
    }
}

Assert-File "src/services/priceService.js"
Assert-File "src/routes/Stock.jsx"
Assert-File "server/server.js"

Write-Host "Running from: $root" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 1. CREATE src/services/yahooFinance.js
# ---------------------------------------------------------------------------
$yahooFinanceJs = @'
// FILE: src/services/yahooFinance.js
import { getApiUrl } from "../config/env.js";

/**
 * Fetch live stock price via the Express /api/yf/price proxy.
 * @param {string} yfSymbol  "AAPL" for US stocks, "2010.SR" for TASI stocks
 * @returns {Promise<{ price: number|null, currency: string }>}
 */
export async function yfPrice(yfSymbol) {
  const url = `${getApiUrl()}/api/yf/price/${encodeURIComponent(yfSymbol)}`;
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

/**
 * Fetch company profile + logo via the Express /api/yf/profile proxy.
 * Returns the exact field names Stock.jsx expects:
 * symbol, name, industry, sector, description, city, country, CEO, website, phone, logoUrl
 * Never throws - returns {} on any error so the page degrades gracefully.
 * @param {string} yfSymbol  "AAPL" for US stocks, "2010.SR" for TASI stocks
 */
export async function yfProfileAndLogo(yfSymbol) {
  try {
    const url = `${getApiUrl()}/api/yf/profile/${encodeURIComponent(yfSymbol)}`;
    const res = await fetch(url, { cache: "no-store", credentials: "include" });
    const json = await res.json();
    if (!res.ok) return {};
    return json;
  } catch {
    return {};
  }
}
'@

Set-Content -Path "src/services/yahooFinance.js" -Value $yahooFinanceJs -Encoding UTF8 -NoNewline
Write-Host "[1/4] Created  src/services/yahooFinance.js" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 2. REPLACE src/services/priceService.js
# ---------------------------------------------------------------------------
$priceServiceJs = @'
// FILE: src/services/priceService.js
import { resolveMarketAndSymbol } from "../data/stocksCatalog.js";
import { toNumber } from "../domain/financials.js";
import { yfPrice } from "./yahooFinance.js";

/**
 * Fetch live stock price from Yahoo Finance via the server-side proxy.
 * Yahoo Finance symbol rules:
 *   US stocks   -> tickerUS as-is      e.g. "AAPL"
 *   TASI stocks -> tickerSA + ".SR"    e.g. "2010" -> "2010.SR"
 */
export async function getLivePrice({ ticker, market } = {}) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r.ok) throw new Error("Ticker not allowed.");

  const { market: resolvedMarket, tickerUS, tickerSA, currency } = r;
  const yfSymbol = resolvedMarket === "sa" ? `${tickerSA}.SR` : tickerUS;

  const result = await yfPrice(yfSymbol);
  const price = toNumber(result?.price) ?? 0;

  return {
    source: "yahoo",
    ticker: resolvedMarket === "us" ? tickerUS : tickerSA,
    market: resolvedMarket,
    price: Number.isFinite(price) ? price : 0,
    currency: result?.currency || currency,
    fetchedAt: new Date().toISOString(),
  };
}
'@

Set-Content -Path "src/services/priceService.js" -Value $priceServiceJs -Encoding UTF8 -NoNewline
Write-Host "[2/4] Replaced src/services/priceService.js" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 3. PATCH server/server.js - insert two routes before /api/analytics/trending
# ---------------------------------------------------------------------------
$serverPath = "server/server.js"
$serverContent = Get-Content $serverPath -Raw -Encoding UTF8

$anchor = 'app.get("/api/analytics/trending"'
if (-not $serverContent.Contains($anchor)) {
    Write-Error "ERROR: Could not find anchor '$anchor' in server/server.js. Has the file changed?"
    exit 1
}
if ($serverContent.Contains("/api/yf/price/")) {
    Write-Host "[3/4] SKIPPED server/server.js - Yahoo Finance routes already present" -ForegroundColor Yellow
} else {
    $yfRoutes = @'
// -- Yahoo Finance proxy ------------------------------------------------------
// Calls Yahoo Finance server-side (browser fetch is blocked by Yahoo's CORS policy).
// Uses Node's built-in fetch (Node 18+). No new npm packages needed.
const _yfCache = new Map();
function yfCached(key, ttlMs, fn) {
  const hit = _yfCache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data);
  return fn().then((data) => { _yfCache.set(key, { data, ts: Date.now() }); return data; });
}
const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// GET /api/yf/price/:symbol  ->  { price: number, currency: string }
app.get("/api/yf/price/:symbol", async (req, res) => {
  const symbol = req.params.symbol;
  try {
    const data = await yfCached(`price:${symbol}`, 60_000, async () => {
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;
      const r = await fetch(url, { headers: YF_HEADERS });
      if (!r.ok) throw new Error(`Yahoo price HTTP ${r.status}`);
      const j = await r.json();
      const meta = j?.chart?.result?.[0]?.meta;
      if (!meta) throw new Error("Yahoo price: no result");
      return { price: meta.regularMarketPrice ?? null, currency: meta.currency ?? "USD" };
    });
    res.json(data);
  } catch (err) {
    console.error("[yf/price]", symbol, err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/yf/profile/:symbol  ->  { symbol, name, industry, sector, description, city, country, CEO, website, phone, logoUrl }
app.get("/api/yf/profile/:symbol", async (req, res) => {
  const symbol = req.params.symbol;
  try {
    const data = await yfCached(`profile:${symbol}`, 6 * 3600_000, async () => {
      const url = `https://query2.finance.yahoo.com/v11/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile%2CquoteType`;
      const r = await fetch(url, { headers: YF_HEADERS });
      if (!r.ok) throw new Error(`Yahoo profile HTTP ${r.status}`);
      const j = await r.json();
      const result = j?.quoteSummary?.result?.[0];
      if (!result) throw new Error("Yahoo profile: no result");
      const ap = result.assetProfile ?? {};
      const qt = result.quoteType ?? {};
      const ceo = (ap.companyOfficers ?? []).find(
        (o) => /ceo|chief exec/i.test(o.title ?? "")
      )?.name ?? null;
      let logoUrl = null;
      if (ap.website) {
        try {
          const domain = new URL(ap.website).hostname.replace(/^www\./, "");
          logoUrl = `https://logo.clearbit.com/${domain}`;
        } catch {}
      }
      return {
        symbol: qt.symbol ?? symbol,
        name: qt.longName ?? qt.shortName ?? null,
        industry: ap.industry ?? null,
        sector: ap.sector ?? null,
        description: ap.longBusinessSummary ?? null,
        city: ap.city ?? null,
        country: ap.country ?? null,
        CEO: ceo,
        website: ap.website ?? null,
        phone: ap.phone ?? null,
        logoUrl,
      };
    });
    res.json(data);
  } catch (err) {
    console.error("[yf/profile]", symbol, err.message);
    res.status(502).json({ error: err.message });
  }
});
// -- End Yahoo Finance proxy --------------------------------------------------

'@
    $serverContent = $serverContent.Replace($anchor, $yfRoutes + $anchor)
    Set-Content -Path $serverPath -Value $serverContent -Encoding UTF8 -NoNewline
    Write-Host "[3/4] Patched  server/server.js (added /api/yf/price and /api/yf/profile routes)" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 4. PATCH src/routes/Stock.jsx - swap import + replace logo/profile useEffect
# ---------------------------------------------------------------------------
$stockPath = "src/routes/Stock.jsx"
$stockContent = Get-Content $stockPath -Raw -Encoding UTF8

# 4a. Swap the import line
$oldImport = 'import { twelveLogo, twelveProfile } from "../services/twelveData.js";'
$newImport = 'import { yfProfileAndLogo } from "../services/yahooFinance.js";'

if (-not $stockContent.Contains($oldImport)) {
    if ($stockContent.Contains($newImport)) {
        Write-Host "[4a] SKIPPED Stock.jsx import - already updated" -ForegroundColor Yellow
    } else {
        Write-Error "ERROR: Could not find the twelveLogo/twelveProfile import line in Stock.jsx. Has the file changed?"
        exit 1
    }
} else {
    $stockContent = $stockContent.Replace($oldImport, $newImport)
}

# 4b. Replace the logo/profile useEffect body
$oldEffect = @'
  // Logo & profile
  useEffect(() => {
    let alive = true;
    setLogoLoadError(false);
    (async () => {
      try {
        const r = await resolveMarketAndSymbol(ticker, market);
        if (!r.ok || !alive) return;
        const symbol = r.symbol;
        const [logoRes, profileRes] = await Promise.all([
          twelveLogo(symbol),
          twelveProfile(symbol),
        ]);
        if (!alive) return;
        const base = logoRes?.logo_base;
        setLogoUrl(base && typeof base === "string" ? base : null);
        setProfile(profileRes && typeof profileRes === "object" ? profileRes : null);
      } catch {
        if (!alive) return;
        setLogoUrl(null);
        setProfile(null);
      }
    })();

    return () => { alive = false; };
  }, [ticker, market]);
'@

$newEffect = @'
  // Logo & profile
  useEffect(() => {
    let alive = true;
    setLogoLoadError(false);
    (async () => {
      try {
        const r = await resolveMarketAndSymbol(ticker, market);
        if (!r.ok || !alive) return;
        // Yahoo Finance symbol: US -> tickerUS (e.g. "AAPL"), TASI -> tickerSA + ".SR" (e.g. "2010.SR")
        const yfSymbol = r.market === "sa" ? `${r.tickerSA}.SR` : r.tickerUS;
        const profileRes = await yfProfileAndLogo(yfSymbol);
        if (!alive) return;
        // Logo comes from Clearbit via profileRes.logoUrl
        setLogoUrl(typeof profileRes?.logoUrl === "string" ? profileRes.logoUrl : null);
        // Profile fields match exactly what the JSX below expects:
        // symbol, name, industry, sector, description, city, country, CEO, website, phone
        setProfile(
          profileRes && typeof profileRes === "object" && Object.keys(profileRes).length > 0
            ? profileRes
            : null
        );
      } catch {
        if (!alive) return;
        setLogoUrl(null);
        setProfile(null);
      }
    })();

    return () => { alive = false; };
  }, [ticker, market]);
'@

if (-not $stockContent.Contains($oldEffect)) {
    if ($stockContent.Contains("yfProfileAndLogo")) {
        Write-Host "[4/4] SKIPPED Stock.jsx useEffect - already updated" -ForegroundColor Yellow
    } else {
        Write-Error "ERROR: Could not find the logo/profile useEffect block in Stock.jsx. Has the file changed?"
        exit 1
    }
} else {
    $stockContent = $stockContent.Replace($oldEffect, $newEffect)
    Set-Content -Path $stockPath -Value $stockContent -Encoding UTF8 -NoNewline
    Write-Host "[4/4] Patched  src/routes/Stock.jsx (import + useEffect)" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "All done. Restart your Express server to pick up the new routes:" -ForegroundColor Cyan
Write-Host "  cd server && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Verification - these should all return true:" -ForegroundColor Cyan
Write-Host "  Test-Path src/services/yahooFinance.js"
Write-Host "  (Get-Content server/server.js -Raw).Contains('/api/yf/price/')"
Write-Host "  (Get-Content src/routes/Stock.jsx -Raw).Contains('yfProfileAndLogo')"
Write-Host "  -not (Get-Content src/routes/Stock.jsx -Raw).Contains('twelveLogo')"
