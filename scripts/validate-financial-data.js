/**
 * Validate sp500_all_financial_data.json and report remaining missing items
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import XLSX from 'xlsx';

const TIME_SERIES_FIELDS = ['sales', 'gross_profit', 'operating_income', 'net_income', 'equity', 'free_cash_flow'];
const JSON_PATH = join(process.cwd(), 'public', 'data', 'sp500_all_financial_data.json');
const REPORT_PATH = join(process.cwd(), 'output', 'SP500_Missing_Financial_Data_Report_After_Fix.xlsx');

const json = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
const report = [];

for (const company of json.companies) {
  const { ticker, company: companyName, data } = company;
  if (!data) continue;

  for (const field of TIME_SERIES_FIELDS) {
    const arr = data[field];
    if (!Array.isArray(arr)) {
      report.push([ticker, companyName, field, '', 'Missing Field']);
      continue;
    }

    if (arr.length === 0) {
      report.push([ticker, companyName, field, '', 'Empty Array']);
      continue;
    }

    const nullEntries = arr.filter((i) => i?.value == null);
    for (const entry of nullEntries) {
      report.push([ticker, companyName, field, entry?.year ?? '', 'Null Value']);
    }
  }
}

const headers = ['Ticker', 'Company', 'Missing_Field', 'Fiscal_Year', 'Reason'];
const wsData = [headers, ...report];
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(wsData);
XLSX.utils.book_append_sheet(wb, ws, 'Missing Data');
XLSX.writeFile(wb, REPORT_PATH);

console.log(`\n=== Validation Report ===`);
console.log(`Total issues found: ${report.length}`);
if (report.length > 0) {
  const byReason = {};
  report.forEach((r) => {
    const reason = r[4] || 'Unknown';
    byReason[reason] = (byReason[reason] || 0) + 1;
  });
  console.log('By reason:', byReason);
  console.log(`\nReport saved to: ${REPORT_PATH}`);
} else {
  console.log('✓ No null values or structural issues found.');
}
