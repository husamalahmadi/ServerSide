# apply-yahoo-finance.ps1
# Run from the ROOT of your project (where package.json lives).
# PowerShell: .\apply-yahoo-finance.ps1
#
# WHAT THIS DOES:
#   Reverts src/services/priceService.js and src/routes/Stock.jsx back to
#   Twelve Data for price + profile, because Yahoo Finance blocks all cloud
#   server IPs (Render, AWS, etc.) with "Host not in allowlist".
#
# Net result: price and profile work correctly via Twelve Data (as they did originally).

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-File($path) {
    if (-not (Test-Path $path)) {
        Write-Error "ERROR: File not found: $path`nRun this from the project root (where package.json is)."
        exit 1
    }
}

Assert-File "src/services/priceService.js"
Assert-File "src/routes/Stock.jsx"
Assert-File "src/services/twelveData.js"

Write-Host "Working from: $(Get-Location)" -ForegroundColor Cyan

# -- 1. RESTORE priceService.js ------------------------------------------------
$priceServiceJs = @'
// FILE: client/src/services/priceService.js
import { resolveMarketAndSymbol } from "../data/stocksCatalog.js";
import { toNumber } from "../domain/financials.js";
import { twelvePrice } from "./twelveData.js";

/**
 * Client-side replacement for GET /api/price/:ticker
 */
export async function getLivePrice({ ticker, market } = {}) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r.ok) throw new Error("Ticker not allowed.");

  const { symbol, currency, market: resolvedMarket, tickerUS, tickerSA } = r;
  const j = await twelvePrice(symbol);
  const price = toNumber(j?.price) ?? 0;

  return {
    source: "live",
    ticker: resolvedMarket === "us" ? tickerUS : tickerSA,
    market: resolvedMarket,
    price: Number.isFinite(price) ? price : 0,
    currency,
    fetchedAt: new Date().toISOString(),
  };
}
'@

Set-Content -Path "src/services/priceService.js" -Value $priceServiceJs -Encoding UTF8 -NoNewline
Write-Host "[1/2] Restored src/services/priceService.js" -ForegroundColor Green

# -- 2. RESTORE Stock.jsx ------------------------------------------------------
$stockPath = "src/routes/Stock.jsx"
$stock = Get-Content $stockPath -Raw -Encoding UTF8

# Fix import
$stock = $stock -replace 'import \{ yfProfileAndLogo \} from "\.\./services/yahooFinance\.js";', 'import { twelveLogo, twelveProfile } from "../services/twelveData.js";'

# Fix useEffect: replace the Yahoo block with Twelve Data block
$oldBlock = @'
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
'@

$newBlock = @'
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
'@

if ($stock.Contains($oldBlock)) {
    $stock = $stock.Replace($oldBlock, $newBlock)
    Write-Host "  Replaced Yahoo useEffect block with Twelve Data" -ForegroundColor Gray
} elseif ($stock.Contains("twelveLogo(symbol)")) {
    Write-Host "  Stock.jsx useEffect already correct - skipping" -ForegroundColor Yellow
} else {
    Write-Error "ERROR: Could not find the useEffect block to replace in Stock.jsx. Was the file modified differently?"
    exit 1
}

Set-Content -Path $stockPath -Value $stock -Encoding UTF8 -NoNewline
Write-Host "[2/2] Restored src/routes/Stock.jsx" -ForegroundColor Green

# -- Verify -------------------------------------------------------------------
$jsx   = Get-Content "src/routes/Stock.jsx" -Raw
$price = Get-Content "src/services/priceService.js" -Raw
$ok    = $true

if (-not $price.Contains("twelvePrice"))     { Write-Host "FAIL: priceService missing twelvePrice"      -ForegroundColor Red; $ok = $false }
if ($price.Contains("yfPrice"))              { Write-Host "FAIL: priceService still has yfPrice"        -ForegroundColor Red; $ok = $false }
if (-not $jsx.Contains("twelveLogo"))        { Write-Host "FAIL: Stock.jsx missing twelveLogo"          -ForegroundColor Red; $ok = $false }
if (-not $jsx.Contains("twelveProfile"))     { Write-Host "FAIL: Stock.jsx missing twelveProfile"       -ForegroundColor Red; $ok = $false }
if ($jsx.Contains("yfProfileAndLogo"))       { Write-Host "FAIL: Stock.jsx still has yfProfileAndLogo"  -ForegroundColor Red; $ok = $false }

Write-Host ""
if ($ok) {
    Write-Host "All checks passed. Price and profile will use Twelve Data." -ForegroundColor Green
    Write-Host "Redeploy to Render (git push) - no manual restart needed." -ForegroundColor Cyan
} else {
    Write-Host "Checks failed - see errors above." -ForegroundColor Red
}
