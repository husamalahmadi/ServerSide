/**
 * Script to add 100 new companies to sp500_all_financial_data.json
 * Companies are S&P 500 recent additions and S&P 400 companies not already in the file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../public/data/sp500_all_financial_data.json');

// 100 companies to add: ticker, company name, industry (GICS sector)
const NEW_COMPANIES = [
  // S&P 500 recent additions (2024-2025)
  { ticker: "APP", company: "AppLovin", industry: "Information Technology" },
  { ticker: "ARES", company: "Ares Management", industry: "Financials" },
  { ticker: "XYZ", company: "Block", industry: "Financials" },
  { ticker: "CIEN", company: "Ciena", industry: "Information Technology" },
  { ticker: "CVNA", company: "Carvana", industry: "Consumer Discretionary" },
  { ticker: "FIX", company: "Comfort Systems USA", industry: "Industrials" },
  { ticker: "CRH", company: "CRH plc", industry: "Materials" },
  { ticker: "EME", company: "Emcor", industry: "Industrials" },
  { ticker: "HOOD", company: "Robinhood Markets", industry: "Financials" },
  { ticker: "IBKR", company: "Interactive Brokers", industry: "Financials" },
  { ticker: "SNDK", company: "Sandisk", industry: "Information Technology" },
  { ticker: "Q", company: "Qnity Electronics", industry: "Information Technology" },
  { ticker: "SOLS", company: "Solstice Advanced Materials", industry: "Materials" },
  { ticker: "PSKY", company: "Paramount Skydance", industry: "Communication Services" },
  // S&P 400 / other large companies
  { ticker: "AA", company: "Alcoa", industry: "Materials" },
  { ticker: "AAON", company: "AAON", industry: "Industrials" },
  { ticker: "ACI", company: "Albertsons", industry: "Consumer Staples" },
  { ticker: "ACM", company: "AECOM", industry: "Industrials" },
  { ticker: "ADC", company: "Agree Realty", industry: "Real Estate" },
  { ticker: "AFG", company: "American Financial Group", industry: "Financials" },
  { ticker: "AGCO", company: "AGCO", industry: "Industrials" },
  { ticker: "AIT", company: "Applied Industrial Technologies", industry: "Industrials" },
  { ticker: "ALK", company: "Alaska Air Group", industry: "Industrials" },
  { ticker: "ALLY", company: "Ally Financial", industry: "Financials" },
  { ticker: "AN", company: "AutoNation", industry: "Consumer Discretionary" },
  { ticker: "ANF", company: "Abercrombie & Fitch", industry: "Consumer Discretionary" },
  { ticker: "ARW", company: "Arrow Electronics", industry: "Information Technology" },
  { ticker: "ASH", company: "Ashland Global", industry: "Materials" },
  { ticker: "ATI", company: "ATI Inc.", industry: "Industrials" },
  { ticker: "BAH", company: "Booz Allen Hamilton", industry: "Industrials" },
  { ticker: "BBWI", company: "Bath & Body Works", industry: "Consumer Discretionary" },
  { ticker: "BC", company: "Brunswick", industry: "Consumer Discretionary" },
  { ticker: "BCO", company: "Brink's", industry: "Industrials" },
  { ticker: "BWA", company: "BorgWarner", industry: "Consumer Discretionary" },
  { ticker: "BWXT", company: "BWX Technologies", industry: "Industrials" },
  { ticker: "BYD", company: "Boyd Gaming", industry: "Consumer Discretionary" },
  { ticker: "CACI", company: "CACI International", industry: "Industrials" },
  { ticker: "CAR", company: "Avis Budget Group", industry: "Industrials" },
  { ticker: "CASY", company: "Casey's General Stores", industry: "Consumer Staples" },
  { ticker: "CAVA", company: "Cava Group", industry: "Consumer Discretionary" },
  { ticker: "CCK", company: "Crown Holdings", industry: "Materials" },
  { ticker: "CELH", company: "Celsius Holdings", industry: "Consumer Staples" },
  { ticker: "CG", company: "Carlyle Group", industry: "Financials" },
  { ticker: "CHH", company: "Choice Hotels", industry: "Consumer Discretionary" },
  { ticker: "CHWY", company: "Chewy", industry: "Consumer Discretionary" },
  { ticker: "CLF", company: "Cleveland-Cliffs", industry: "Materials" },
  { ticker: "CMC", company: "Commercial Metals", industry: "Materials" },
  { ticker: "CNH", company: "CNH Industrial", industry: "Industrials" },
  { ticker: "CNO", company: "CNO Financial Group", industry: "Financials" },
  { ticker: "CR", company: "Crane", industry: "Industrials" },
  { ticker: "CROX", company: "Crocs", industry: "Consumer Discretionary" },
  { ticker: "CSL", company: "Carlisle Companies", industry: "Industrials" },
  { ticker: "CUBE", company: "CubeSmart", industry: "Real Estate" },
  { ticker: "CW", company: "Curtiss-Wright", industry: "Industrials" },
  { ticker: "DCI", company: "Donaldson Company", industry: "Industrials" },
  { ticker: "DINO", company: "HF Sinclair", industry: "Energy" },
  { ticker: "DKS", company: "Dick's Sporting Goods", industry: "Consumer Discretionary" },
  { ticker: "DOCU", company: "Docusign", industry: "Information Technology" },
  { ticker: "DT", company: "Dynatrace", industry: "Information Technology" },
  { ticker: "DUOL", company: "Duolingo", industry: "Consumer Discretionary" },
  { ticker: "EHC", company: "Encompass Health", industry: "Health Care" },
  { ticker: "ELF", company: "e.l.f. Beauty", industry: "Consumer Staples" },
  { ticker: "ENTG", company: "Entegris", industry: "Information Technology" },
  { ticker: "EVR", company: "Evercore", industry: "Financials" },
  { ticker: "EXP", company: "Eagle Materials", industry: "Materials" },
  { ticker: "FAF", company: "First American Financial", industry: "Financials" },
  { ticker: "FLEX", company: "Flex Ltd.", industry: "Information Technology" },
  { ticker: "FND", company: "Floor & Decor", industry: "Consumer Discretionary" },
  { ticker: "FTI", company: "TechnipFMC", industry: "Energy" },
  { ticker: "G", company: "Genpact", industry: "Industrials" },
  { ticker: "GAP", company: "Gap Inc.", industry: "Consumer Discretionary" },
  { ticker: "GME", company: "GameStop", industry: "Consumer Discretionary" },
  { ticker: "GMED", company: "Globus Medical", industry: "Health Care" },
  { ticker: "GWRE", company: "Guidewire Software", industry: "Information Technology" },
  { ticker: "GXO", company: "GXO Logistics", industry: "Industrials" },
  { ticker: "H", company: "Hyatt", industry: "Consumer Discretionary" },
  { ticker: "HLNE", company: "Hamilton Lane", industry: "Financials" },
  { ticker: "HOG", company: "Harley-Davidson", industry: "Consumer Discretionary" },
  { ticker: "HRB", company: "H&R Block", industry: "Consumer Discretionary" },
  { ticker: "HXL", company: "Hexcel", industry: "Industrials" },
  { ticker: "ILMN", company: "Illumina", industry: "Health Care" },
  { ticker: "INGR", company: "Ingredion", industry: "Consumer Staples" },
  { ticker: "IPGP", company: "IPG Photonics", industry: "Information Technology" },
  { ticker: "JWN", company: "Nordstrom", industry: "Consumer Discretionary" },
  { ticker: "KEX", company: "Kirby Corporation", industry: "Industrials" },
  { ticker: "LBRT", company: "Liberty Energy", industry: "Energy" },
  { ticker: "MDU", company: "MDU Resources", industry: "Industrials" },
  { ticker: "MUSA", company: "Murphy USA", industry: "Consumer Staples" },
  { ticker: "NBIX", company: "Neurocrine Biosciences", industry: "Health Care" },
  { ticker: "NOV", company: "NOV Inc.", industry: "Energy" },
  { ticker: "NR", company: "Newpark Resources", industry: "Energy" },
  { ticker: "OGN", company: "Organon", industry: "Health Care" },
  { ticker: "PEN", company: "Penumbra", industry: "Health Care" },
  { ticker: "PINC", company: "Premier Inc.", industry: "Health Care" },
  { ticker: "POWI", company: "Power Integrations", industry: "Information Technology" },
  { ticker: "RBC", company: "RBC Bearings", industry: "Industrials" },
  { ticker: "RPM", company: "RPM International", industry: "Materials" },
  { ticker: "SAIA", company: "Saia", industry: "Industrials" },
  { ticker: "SIG", company: "Signet Jewelers", industry: "Consumer Discretionary" },
  { ticker: "SNV", company: "Synovus Financial", industry: "Financials" },
  { ticker: "SPB", company: "Spectrum Brands", industry: "Consumer Staples" },
  { ticker: "TDC", company: "Teradata", industry: "Information Technology" },
  { ticker: "TOL", company: "Toll Brothers", industry: "Consumer Discretionary" },
  { ticker: "UAA", company: "Under Armour", industry: "Consumer Discretionary" },
  { ticker: "VSTO", company: "Vista Outdoor", industry: "Consumer Discretionary" },
  { ticker: "WING", company: "Wingstop", industry: "Consumer Discretionary" },
  { ticker: "WSO", company: "Watsco", industry: "Industrials" },
  { ticker: "ZION", company: "Zions Bancorp", industry: "Financials" },
  { ticker: "WDFC", company: "WD-40 Company", industry: "Materials" },
];

// Placeholder data structure matching existing format
function createPlaceholderData() {
  const emptySeries = [];
  return {
    enterprise_value: null,
    market_capitalization: null,
    forward_pe: null,
    price_to_sales_ttm: null,
    outstanding_common_stocks: null,
    sales: emptySeries,
    gross_profit: emptySeries,
    operating_income: emptySeries,
    net_income: emptySeries,
    equity: emptySeries,
    free_cash_flow: emptySeries,
    short_term_debt: null,
    long_term_debt: null,
    cash_and_cash_equivalents: null
  };
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const existingTickers = new Set(data.companies.map(c => c.ticker));

  const toAdd = NEW_COMPANIES.filter(c => !existingTickers.has(c.ticker));
  console.log(`Adding ${toAdd.length} companies (${NEW_COMPANIES.length - toAdd.length} already exist)`);

  const newEntries = toAdd.map(({ ticker, company, industry }) => ({
    ticker,
    company,
    industry,
    symbol: ticker,
    data: createPlaceholderData()
  }));

  data.companies.push(...newEntries);
  data.meta.total_companies = data.companies.length;

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Successfully added ${newEntries.length} companies. Total: ${data.companies.length}`);
}

main();
