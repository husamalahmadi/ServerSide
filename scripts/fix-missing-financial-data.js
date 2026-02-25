/**
 * Fix missing financial data in sp500_all_financial_data.json
 * - Removes null/undefined values from time-series arrays
 * - Validates and reports remaining issues
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TIME_SERIES_FIELDS = ['sales', 'gross_profit', 'operating_income', 'net_income', 'equity', 'free_cash_flow'];
const JSON_PATH = join(process.cwd(), 'public', 'data', 'sp500_all_financial_data.json');

function fixAndValidate() {
  const json = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
  const report = { fixed: [], remaining: [], emptyArrays: [] };
  let totalFixed = 0;

  for (const company of json.companies) {
    const { ticker, company: companyName, data } = company;
    if (!data) continue;

    for (const field of TIME_SERIES_FIELDS) {
      const arr = data[field];
      if (!Array.isArray(arr)) continue;

      const beforeLen = arr.length;
      const filtered = arr.filter((item) => {
        if (item && typeof item === 'object' && 'value' in item) {
          return item.value != null; // Filter out null and undefined
        }
        return true; // Keep malformed entries for now
      });
      const afterLen = filtered.length;
      const removed = beforeLen - afterLen;

      if (removed > 0) {
        data[field] = filtered;
        totalFixed += removed;
        report.fixed.push({
          ticker,
          company: companyName,
          field,
          removed,
          years: arr.filter((i) => i?.value == null).map((i) => i?.year),
        });
      }

      if (filtered.length === 0 && beforeLen === 0) {
        report.emptyArrays.push({ ticker, company: companyName, field });
      } else if (filtered.some((i) => i?.value == null)) {
        report.remaining.push({
          ticker,
          company: companyName,
          field,
          count: filtered.filter((i) => i?.value == null).length,
        });
      }
    }
  }

  return { json, report, totalFixed };
}

const { json, report, totalFixed } = fixAndValidate();

writeFileSync(JSON_PATH, JSON.stringify(json, null, 2), 'utf-8');

console.log(`\n=== Fix Summary ===`);
console.log(`Total null/undefined values removed: ${totalFixed}`);
console.log(`Companies/fields affected: ${report.fixed.length}`);

if (report.fixed.length > 0) {
  console.log(`\nFixed entries (first 20):`);
  report.fixed.slice(0, 20).forEach((r) => {
    console.log(`  ${r.ticker} (${r.company}): ${r.field} - removed ${r.removed} null(s) for years ${r.years?.join(', ') || '?'}`);
  });
}

if (report.remaining.length > 0) {
  console.log(`\n⚠ Remaining null values (unexpected): ${report.remaining.length}`);
  report.remaining.forEach((r) => console.log(`  ${r.ticker} ${r.field}: ${r.count}`));
}

console.log(`\nEmpty arrays (no data available - left as-is): ${report.emptyArrays.length}`);
const emptyByField = {};
report.emptyArrays.forEach((e) => {
  emptyByField[e.field] = (emptyByField[e.field] || 0) + 1;
});
Object.entries(emptyByField).forEach(([f, c]) => console.log(`  ${f}: ${c} companies`));

console.log(`\n✓ Updated ${JSON_PATH}`);
