import XLSX from 'xlsx';
import { readFileSync } from 'fs';

const excelPath = 'c:\\Users\\MF\\Downloads\\SP500_Missing_Financial_Data_Report.xlsx';
const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log(JSON.stringify(data, null, 2));
