/**
 * Update tasi_all_financial_data.json and tasi_grouped_by_industry.json based on TASI CSV report.
 * CSV columns: Ticker, Company_Name, Missing_Field, Fiscal_Year, Reason
 * - "Null Value": Remove the entry with that year from the time-series array
 * - "Empty Array": Identify companies with ALL key fields empty, remove those companies
 *
 * Usage: node scripts/fix-tasi-from-csv.js [path/to/TASI_Missing_Financial_Data.csv]
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CSV_PATH = process.argv[2] || 'c:\\Users\\MF\\Downloads\\TASI_Missing_Financial_Data.csv';
const DATA_JSON = join(process.cwd(), 'public', 'data', 'tasi_all_financial_data.json');
const INDUSTRY_JSON = join(process.cwd(), 'public', 'data', 'tasi_grouped_by_industry.json');

const KEY_FIELDS = ['sales', 'operating_income', 'net_income', 'equity', 'free_cash_flow'];

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
const emptyRows = rows.filter((r) => (r.Reason || '').toLowerCase().includes('empty array'));

const tickerEmptyFields = {};
for (const row of emptyRows) {
  const ticker = String(row.Ticker || '').trim();
  const field = (row.Missing_Field || '').trim();
  if (!ticker || !field) continue;
  if (!tickerEmptyFields[ticker]) tickerEmptyFields[ticker] = new Set();
  tickerEmptyFields[ticker].add(field);
}

const tickersToRemove = Object.entries(tickerEmptyFields)
  .filter(([, fields]) => KEY_FIELDS.every((f) => fields.has(f)))
  .map(([t]) => t);

const data = JSON.parse(readFileSync(DATA_JSON, 'utf-8'));
const industry = JSON.parse(readFileSync(INDUSTRY_JSON, 'utf-8'));

let nullRemoved = 0;
for (const row of nullRows) {
  const ticker = String(row.Ticker || '').trim();
  const field = (row.Missing_Field || '').trim();
  const yearStr = (row.Fiscal_Year || '').trim();
  const year = yearStr ? parseInt(yearStr, 10) : null;

  const c = data.companies.find((x) => String(x.ticker) === ticker);
  if (!c?.data?.[field]) continue;

  const arr = c.data[field];
  if (!Array.isArray(arr)) continue;

  const filtered = arr.filter((item) => !(year != null && item?.year === year));
  const removed = arr.length - filtered.length;
  if (removed > 0) {
    c.data[field] = filtered;
    nullRemoved += removed;
  }
}

const beforeCount = data.companies.length;
data.companies = data.companies.filter((c) => !tickersToRemove.includes(String(c.ticker)));
const companiesRemoved = beforeCount - data.companies.length;
data.meta.total_companies = data.companies.length;

for (const [indName, items] of Object.entries(industry)) {
  industry[indName] = items.filter((item) => !tickersToRemove.includes(String(item.Ticker)));
}

writeFileSync(DATA_JSON, JSON.stringify(data, null, 2), 'utf-8');
writeFileSync(INDUSTRY_JSON, JSON.stringify(industry, null, 2), 'utf-8');

console.log('\n=== Fix TASI from CSV ===');
console.log(`Null value entries removed: ${nullRemoved}`);
console.log(`Companies removed (all empty): ${companiesRemoved}`);
if (tickersToRemove.length > 0) {
  console.log('Removed tickers:', tickersToRemove.join(', '));
}
console.log(`\n✓ Updated ${DATA_JSON}`);
console.log(`✓ Updated ${INDUSTRY_JSON}\n`);
