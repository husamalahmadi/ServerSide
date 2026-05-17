/**
 * Build screener_us.json and screener_sa.json from FMP (3-month snapshots on server disk).
 * Run from repo root: node scripts/build-screener-from-fmp.mjs [us|sa|all] [--limit N]
 */
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { fmpApiKey } from "../server/fmpFetch.js";
import { createFinancialsStore, resolveFmpFinancialsDir } from "../server/fmpFinancialsStore.js";
import { createScreenerStore, resolveScreenerDir } from "../server/screenerStore.js";
import { buildScreenerMarket, buildAllScreeners } from "../server/buildScreenerFromFmp.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env") });
dotenv.config({ path: join(root, "server", ".env") });

const key = fmpApiKey();
if (!key) {
  console.error("FMP_API_KEY is required (server/.env or repo-root .env)");
  process.exit(1);
}

const arg = process.argv[2] || "all";
const limitIdx = process.argv.indexOf("--limit");
const maxTickers = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : undefined;
const delayMs = Number(process.env.SCREENER_FMP_DELAY_MS || 350);

const financialsStore = createFinancialsStore(resolveFmpFinancialsDir());
const screenerStore = createScreenerStore(resolveScreenerDir());

console.log(`[screener/build] financials cache: ${financialsStore.cacheDir}`);
console.log(`[screener/build] screener output: ${screenerStore.cacheDir}`);

if (arg === "all") {
  await buildAllScreeners({ apiKey: key, financialsStore, screenerStore, delayMs });
} else if (arg === "us" || arg === "sa") {
  const { items, stats } = await buildScreenerMarket(arg, {
    apiKey: key,
    financialsStore,
    delayMs,
    maxTickers: Number.isFinite(maxTickers) ? maxTickers : undefined,
  });
  const saved = screenerStore.write(arg, items, { buildStats: stats });
  console.log(`[screener/build] wrote ${saved.filePath} (${items.length} items)`, stats);
} else {
  console.error("Usage: node scripts/build-screener-from-fmp.mjs [us|sa|all] [--limit N]");
  process.exit(1);
}
