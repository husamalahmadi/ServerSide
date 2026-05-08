# apply-yahoo-finance.ps1
# Run from the ROOT of your project (where package.json lives).
# PowerShell: .\apply-yahoo-finance.ps1
#
# Uses the yahoo-finance2 npm package in server/ to fetch profile data.
# This package handles Yahoo's crumb/cookie auth automatically.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path "server/server.js")) {
    Write-Error "Run this from the project root (where package.json is)."
    exit 1
}
Write-Host "Working from: $(Get-Location)" -ForegroundColor Cyan

# -- Step 1: Add yahoo-finance2 to server/package.json ------------------------
Write-Host "[1/3] Adding yahoo-finance2 to server/package.json..." -ForegroundColor Cyan
$pkg = Get-Content "server/package.json" -Raw | ConvertFrom-Json
if (-not $pkg.dependencies.'yahoo-finance2') {
    $pkg.dependencies | Add-Member -NotePropertyName 'yahoo-finance2' -NotePropertyValue '^2.13.3' -Force
    $pkg | ConvertTo-Json -Depth 10 | Set-Content "server/package.json" -Encoding UTF8
    Write-Host "  Added yahoo-finance2 ^2.13.3" -ForegroundColor Gray
} else {
    Write-Host "  Already present" -ForegroundColor Yellow
}

# -- Step 2: Patch server/server.js using Node.js -----------------------------
Write-Host "[2/3] Patching server/server.js..." -ForegroundColor Cyan

$nodeScript = @'
const fs = require("fs");
const serverPath = "server/server.js";
let server = fs.readFileSync(serverPath, "utf8");

// ── A: Add yahoo-finance2 import at the top (after the last existing import) ──
const importLine = 'import yahooFinance from "yahoo-finance2";';
if (!server.includes(importLine)) {
  // Insert after the last import line
  const lastImport = 'import { validateComment } from "./commentFilter.js";';
  if (!server.includes(lastImport)) {
    console.error("ERROR: Could not find insertion point for import in server.js");
    process.exit(1);
  }
  server = server.replace(lastImport, lastImport + "\n" + importLine);
  console.log("  Added yahoo-finance2 import");
}

// ── B: Replace the /api/yf/profile route with a yahoo-finance2 version ────────
// Find from "// GET /api/yf/profile" to "// -- End Yahoo Finance proxy"
const profileStart = "// GET /api/yf/profile/:symbol";
const proxyEnd     = "// -- End Yahoo Finance proxy";

const si = server.indexOf(profileStart);
const ei = server.indexOf(proxyEnd);

if (si === -1 || ei === -1) {
  // Routes not added yet at all — check if we need to add the whole block
  const anchor = 'app.get("/api/analytics/trending"';
  if (!server.includes(anchor)) {
    console.error("ERROR: Cannot find analytics/trending anchor in server.js");
    process.exit(1);
  }

  const fullBlock = `
// ── Yahoo Finance proxy ───────────────────────────────────────────────────────
// Uses yahoo-finance2 npm package which handles Yahoo's crumb/cookie auth.
const _yfCache = new Map();
function yfCached(key, ttlMs, fn) {
  const hit = _yfCache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data);
  return fn().then((data) => { _yfCache.set(key, { data, ts: Date.now() }); return data; });
}

// GET /api/yf/price/:symbol  ->  { price, currency }
app.get("/api/yf/price/:symbol", async (req, res) => {
  const symbol = req.params.symbol;
  try {
    const data = await yfCached(\`price:\${symbol}\`, 60_000, async () => {
      const quote = await yahooFinance.quote(symbol);
      return {
        price:    quote.regularMarketPrice ?? null,
        currency: quote.currency ?? "USD",
      };
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
    const data = await yfCached(\`profile:\${symbol}\`, 6 * 3600_000, async () => {
      const result = await yahooFinance.quoteSummary(symbol, { modules: ["assetProfile", "quoteType"] });
      const ap = result?.assetProfile ?? {};
      const qt = result?.quoteType ?? {};
      const ceo = (ap.companyOfficers ?? []).find(
        (o) => /ceo|chief exec/i.test(o.title ?? "")
      )?.name ?? null;
      let logoUrl = null;
      if (ap.website) {
        try {
          const domain = new URL(ap.website).hostname.replace(/^www\\./, "");
          logoUrl = \`https://logo.clearbit.com/\${domain}\`;
        } catch {}
      }
      return {
        symbol:      qt.symbol ?? symbol,
        name:        qt.longName ?? qt.shortName ?? null,
        industry:    ap.industry ?? null,
        sector:      ap.sector ?? null,
        description: ap.longBusinessSummary ?? null,
        city:        ap.city ?? null,
        country:     ap.country ?? null,
        CEO:         ceo,
        website:     ap.website ?? null,
        phone:       ap.phone ?? null,
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

`;
  server = server.replace(anchor, fullBlock + anchor);
  console.log("  Added full Yahoo Finance proxy block (price + profile)");

} else {
  // Routes exist — only replace the profile section
  const newProfile = `// GET /api/yf/profile/:symbol  ->  { symbol, name, industry, sector, description, city, country, CEO, website, phone, logoUrl }
app.get("/api/yf/profile/:symbol", async (req, res) => {
  const symbol = req.params.symbol;
  try {
    const data = await yfCached(\`profile:\${symbol}\`, 6 * 3600_000, async () => {
      const result = await yahooFinance.quoteSummary(symbol, { modules: ["assetProfile", "quoteType"] });
      const ap = result?.assetProfile ?? {};
      const qt = result?.quoteType ?? {};
      const ceo = (ap.companyOfficers ?? []).find(
        (o) => /ceo|chief exec/i.test(o.title ?? "")
      )?.name ?? null;
      let logoUrl = null;
      if (ap.website) {
        try {
          const domain = new URL(ap.website).hostname.replace(/^www\\./, "");
          logoUrl = \`https://logo.clearbit.com/\${domain}\`;
        } catch {}
      }
      return {
        symbol:      qt.symbol ?? symbol,
        name:        qt.longName ?? qt.shortName ?? null,
        industry:    ap.industry ?? null,
        sector:      ap.sector ?? null,
        description: ap.longBusinessSummary ?? null,
        city:        ap.city ?? null,
        country:     ap.country ?? null,
        CEO:         ceo,
        website:     ap.website ?? null,
        phone:       ap.phone ?? null,
        logoUrl,
      };
    });
    res.json(data);
  } catch (err) {
    console.error("[yf/profile]", symbol, err.message);
    res.status(502).json({ error: err.message });
  }
});
`;
  server = server.slice(0, si) + newProfile + server.slice(ei);
  console.log("  Replaced profile route with yahoo-finance2 version");
}

fs.writeFileSync(serverPath, server, "utf8");

// ── Verify ──────────────────────────────────────────────────────────────────
const final = fs.readFileSync(serverPath, "utf8");
const ok =
  final.includes('import yahooFinance from "yahoo-finance2"') &&
  final.includes('yahooFinance.quoteSummary') &&
  final.includes('/api/yf/profile/') &&
  final.indexOf('/api/yf/profile/') < final.indexOf('app.get("*"');

console.log(ok ? "server.js VERIFY: PASS" : "server.js VERIFY: FAIL");
process.exit(ok ? 0 : 1);
'@

$tmp = [System.IO.Path]::GetTempFileName() + ".js"
[System.IO.File]::WriteAllText($tmp, $nodeScript, [System.Text.Encoding]::UTF8)
node $tmp
$exit = $LASTEXITCODE
Remove-Item $tmp -ErrorAction SilentlyContinue
if ($exit -ne 0) { Write-Error "server.js patch failed"; exit 1 }
Write-Host "[2/3] server/server.js patched" -ForegroundColor Green

# -- Step 3: Ensure Stock.jsx uses yfProfileAndLogo ----------------------------
Write-Host "[3/3] Checking src/routes/Stock.jsx..." -ForegroundColor Cyan

$nodeScript2 = @'
const fs = require("fs");
const stockPath = "src/routes/Stock.jsx";
let stock = fs.readFileSync(stockPath, "utf8");
let changed = false;

// Fix import if still on twelveData
const badImport  = 'import { twelveLogo, twelveProfile } from "../services/twelveData.js";';
const goodImport = 'import { yfProfileAndLogo } from "../services/yahooFinance.js";';
if (stock.includes(badImport)) {
  stock = stock.replace(badImport, goodImport);
  changed = true;
  console.log("  Fixed import (twelveData -> yahooFinance)");
} else if (stock.includes(goodImport)) {
  console.log("  Import already correct");
}

// Fix useEffect if reverted to twelveData
if (stock.includes("twelveLogo(symbol)")) {
  const tryLine   = "      try {";
  const catchLine = "      } catch {";
  const badIdx    = stock.indexOf("twelveLogo(symbol)");
  const tryIdx    = stock.lastIndexOf(tryLine, badIdx);
  const catchIdx  = stock.indexOf(catchLine, badIdx);
  const replacement = `      try {
        const r = await resolveMarketAndSymbol(ticker, market);
        if (!r.ok || !alive) return;
        const yfSymbol = r.market === "sa" ? r.tickerSA + ".SR" : r.tickerUS;
        const profileRes = await yfProfileAndLogo(yfSymbol);
        if (!alive) return;
        setLogoUrl(typeof profileRes?.logoUrl === "string" ? profileRes.logoUrl : null);
        setProfile(
          profileRes && typeof profileRes === "object" && Object.keys(profileRes).length > 0
            ? profileRes : null
        );
`;
  stock = stock.slice(0, tryIdx) + replacement + stock.slice(catchIdx);
  changed = true;
  console.log("  Fixed useEffect (twelveData -> yfProfileAndLogo)");
} else if (stock.includes("yfProfileAndLogo")) {
  console.log("  useEffect already correct");
}

if (changed) fs.writeFileSync(stockPath, stock, "utf8");

const final = fs.readFileSync(stockPath, "utf8");
const ok = final.includes("yfProfileAndLogo") && !final.includes("twelveLogo");
console.log(ok ? "Stock.jsx VERIFY: PASS" : "Stock.jsx VERIFY: FAIL");

// Make sure yahooFinance.js client service exists
const yfServiceExists = require("fs").existsSync("src/services/yahooFinance.js");
if (!yfServiceExists) {
  const yfService = `// FILE: src/services/yahooFinance.js
import { getApiUrl } from "../config/env.js";

export async function yfPrice(yfSymbol) {
  const url = \`${getApiUrl()}/api/yf/price/\${encodeURIComponent(yfSymbol)}\`;
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || \`HTTP \${res.status}\`);
  return json;
}

export async function yfProfileAndLogo(yfSymbol) {
  try {
    const url = \`${getApiUrl()}/api/yf/profile/\${encodeURIComponent(yfSymbol)}\`;
    const res = await fetch(url, { cache: "no-store", credentials: "include" });
    const json = await res.json();
    if (!res.ok) return {};
    return json;
  } catch {
    return {};
  }
}
`;
  fs.writeFileSync("src/services/yahooFinance.js", yfService, "utf8");
  console.log("  Created src/services/yahooFinance.js");
}

process.exit(ok ? 0 : 1);
'@

$tmp2 = [System.IO.Path]::GetTempFileName() + ".js"
[System.IO.File]::WriteAllText($tmp2, $nodeScript2, [System.Text.Encoding]::UTF8)
node $tmp2
$exit2 = $LASTEXITCODE
Remove-Item $tmp2 -ErrorAction SilentlyContinue
if ($exit2 -ne 0) { Write-Error "Stock.jsx patch failed"; exit 1 }
Write-Host "[3/3] src/routes/Stock.jsx verified" -ForegroundColor Green

# -- Done ---------------------------------------------------------------------
Write-Host ""
Write-Host "Done. Now run:" -ForegroundColor Green
Write-Host "  cd server && npm install" -ForegroundColor White
Write-Host ""
Write-Host "Then push to GitHub:" -ForegroundColor Green
Write-Host "  git add server/package.json server/server.js src/routes/Stock.jsx src/services/yahooFinance.js" -ForegroundColor White
Write-Host "  git commit -m 'fix: use yahoo-finance2 package for profile data'" -ForegroundColor White
Write-Host "  git push" -ForegroundColor White
