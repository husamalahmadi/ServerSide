/**
 * Builds lightweight screener JSON from full financial_data files (~50MB → ~200KB).
 * Run: node scripts/build-screener-data.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { collectScreenerItems } from "../src/domain/screenerMetrics.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pairs = [
  ["public/data/sp500_financial_data.json", "public/data/screener_us.json", "us"],
  ["public/data/tasi_financial_data.json", "public/data/screener_sa.json", "sa"],
];

for (const [srcRel, outRel, market] of pairs) {
  const src = join(root, srcRel);
  const out = join(root, outRel);
  const json = JSON.parse(readFileSync(src, "utf8"));
  const items = collectScreenerItems(json, market);
  const payload = {
    meta: {
      source: srcRel,
      market,
      generated_at: new Date().toISOString(),
      count: items.length,
    },
    items,
  };
  writeFileSync(out, JSON.stringify(payload));
  console.log(`[screener] ${outRel}: ${items.length} rows`);
}
