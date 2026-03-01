/**
 * Remove null/missing entries from sp500_all_financial_data.json based on CSV report.
 * CSV columns: Ticker, Company_Name, Missing_Field, Fiscal_Year, Reason
 * - "Null Value": Remove the entry with that year from the time-series array
 * - "Empty Array": No action (array is empty, nothing to remove)
 *
 * Usage: node scripts/fix-from-csv.js [path/to/missing_data.csv]
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CSV_PATH = process.argv[2] || 'c:\\Users\\MF\\Downloads\\SP500_Missing_Financial_Data.csv';
const JSON_PATH = join(process.cwd(), 'public', 'data', 'sp500_all_financial_data.json');

function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((h, j) => (row[h] = values[j] || ''));
    rows.push(row);
  }
  return rows;
}

const csv = readFileSync(CSV_PATH, 'utf-8');
const rows = parseCSV(csv);
const nullRows = rows.filter((r) => (r.Reason || '').toLowerCase().includes('null value'));

const json = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
const tickerToCompany = {};
json.companies.forEach((c, i) => {
  tickerToCompany[c.ticker] = { index: i, company: c };
});

let totalRemoved = 0;
const report = [];

for (const row of nullRows) {
  const ticker = (row.Ticker || '').trim().toUpperCase();
  const field = (row.Missing_Field || '').trim();
  const yearStr = (row.Fiscal_Year || '').trim();
  const year = yearStr ? parseInt(yearStr, 10) : null;

  const entry = tickerToCompany[ticker];
  if (!entry) continue;

  const c = entry.company;
  const data = c.data;
  if (!data) continue;

  const arr = data[field];
  if (!Array.isArray(arr)) continue;

  const beforeLen = arr.length;
  const filtered = arr.filter((item) => {
    const itemYear = item?.year;
    const matchesYear = year != null && itemYear === year;
    if (matchesYear) {
      return false;
    }
    return true;
  });

  const removed = beforeLen - filtered.length;
  if (removed > 0) {
    data[field] = filtered;
    totalRemoved += removed;
    report.push({ ticker, field, year, removed });
  }
}

writeFileSync(JSON_PATH, JSON.stringify(json, null, 2), 'utf-8');

console.log('\n=== Fix from CSV ===');
console.log(`Processed ${nullRows.length} "Null Value" rows from CSV`);
console.log(`Removed ${totalRemoved} null entries from JSON`);
if (report.length > 0) {
  console.log('\nRemoved entries (first 20):');
  report.slice(0, 20).forEach((r) => {
    console.log(`  ${r.ticker} ${r.field} year ${r.year}: ${r.removed}`);
  });
}
console.log(`\n✓ Updated ${JSON_PATH}\n`);
