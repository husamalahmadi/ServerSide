import Database from "better-sqlite3";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const FMP_API_KEY = process.env.FMP_API_KEY || "";
const CACHE_TTL_SEC = 30 * 24 * 60 * 60;

let _db = null;
function getDb() {
  if (_db) return _db;
  const dbPath = process.env.DB_PATH || "/var/data/trueprice.db";
  _db = new Database(dbPath);
  _db.exec(`CREATE TABLE IF NOT EXISTS ai_reports (
    symbol TEXT PRIMARY KEY,
    report_json TEXT NOT NULL,
    generated_at INTEGER NOT NULL
  )`);
  return _db;
}

function readCached(symbol) {
  try {
    const row = getDb()
      .prepare("SELECT report_json, generated_at FROM ai_reports WHERE symbol = ?")
      .get(symbol);
    if (!row) return null;
    if (Math.floor(Date.now() / 1000) - row.generated_at > CACHE_TTL_SEC) return null;
    return JSON.parse(row.report_json);
  } catch { return null; }
}

function writeCache(symbol, report) {
  try {
    getDb()
      .prepare("INSERT OR REPLACE INTO ai_reports (symbol, report_json, generated_at) VALUES (?, ?, ?)")
      .run(symbol, JSON.stringify(report), Math.floor(Date.now() / 1000));
  } catch (e) {
    console.warn("[aiReport] cache write failed:", e.message);
  }
}

// Step 1: YOUR SERVER fetches real data from FMP
async function fetchFMPData(symbol) {
  const base = "https://financialmodelingprep.com/stable";
  const key = FMP_API_KEY;

  console.log(`[aiReport] fetching FMP data for ${symbol}...`);

  const [incomeRes, balanceRes, cashflowRes, profileRes] = await Promise.all([
    fetch(`${base}/income-statement?symbol=${symbol}&limit=4&apikey=${key}`),
    fetch(`${base}/balance-sheet-statement?symbol=${symbol}&limit=2&apikey=${key}`),
    fetch(`${base}/cash-flow-statement?symbol=${symbol}&limit=2&apikey=${key}`),
    fetch(`${base}/profile?symbol=${symbol}&apikey=${key}`)
  ]);

  const [income, balance, cashflow, profile] = await Promise.all([
    incomeRes.json(),
    balanceRes.json(),
    cashflowRes.json(),
    profileRes.json()
  ]);

  console.log(`[aiReport] FMP income records: ${income?.length || 0}, profile: ${profile?.[0]?.companyName || "unknown"}`);

  return { income, balance, cashflow, profile };
}

export async function generateAiReport(symbol, forceRefresh = false) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  console.log(`[aiReport] symbol=${symbol}`);

  if (!forceRefresh) {
    const cached = readCached(symbol);
    if (cached) {
      console.log(`[aiReport] cache hit ${symbol}`);
      return { report: cached, source: "cache" };
    }
  }

  // Step 1: Fetch real data from FMP first
  const fmpData = await fetchFMPData(symbol);

  const profile = fmpData.profile?.[0] || {};
  const incomeStatements = fmpData.income || [];
  const balanceSheets = fmpData.balance || [];
  const cashFlows = fmpData.cashflow || [];

  if (!incomeStatements.length) {
    throw new Error(`No financial data found in FMP for symbol ${symbol}`);
  }

  const currentPrice = profile.price || "N/A";
  const companyName = profile.companyName || symbol;
  const currency = profile.currency || "SAR";

  // Step 2: Send the REAL data to Claude for analysis
  console.log(`[aiReport] sending real FMP data to Claude for ${symbol}...`);

  const dataContext = `
REAL FINANCIAL DATA FROM FMP API FOR ${symbol}:

Company: ${companyName}
Current Price: ${currentPrice} ${currency}
Market Cap: ${profile.mktCap || "N/A"}
Industry: ${profile.industry || "N/A"}
Description: ${profile.description || "N/A"}

INCOME STATEMENTS (most recent first):
${JSON.stringify(incomeStatements, null, 2)}

BALANCE SHEETS (most recent first):
${JSON.stringify(balanceSheets, null, 2)}

CASH FLOW STATEMENTS (most recent first):
${JSON.stringify(cashFlows, null, 2)}
`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: `You are a financial analyst for TruePrice.Cash. You will be given REAL financial data already fetched from FMP API. Use ONLY the data provided — do not use your training memory for financial figures. Extract the actual numbers from the data and write a professional bilingual investment report.

Return ONLY a valid JSON object — no markdown, no explanation. Use this exact structure:

{
  "symbol": "${symbol}",
  "companyName": "${companyName}",
  "reportDate": "${new Date().toISOString().split("T")[0]}",
  "currentPrice": "${currentPrice} ${currency}",
  "currency": "${currency}",
  "charts": {
    "years": ["year1","year2","year3","year4"],
    "revenue": [number, number, number, number],
    "operatingIncome": [number, number, number, number],
    "operatingCashFlow": [number, number, number, number]
  },
  "english": {
    "executiveSummary": "4-6 sentences about the company, its position, and investment verdict",
    "revenueAnalysis": "Analysis of revenue trend with real numbers from the data",
    "margins": {
      "years": ["year1","year2","year3","year4"],
      "grossMargin": ["x%","x%","x%","x%"],
      "operatingMargin": ["x%","x%","x%","x%"],
      "netMargin": ["x%","x%","x%","x%"]
    },
    "balanceSheet": {
      "analysis": "Analysis of balance sheet health",
      "items": [
        {"label":"Total Assets","prior":"x","latest":"x","change":"x%"},
        {"label":"Total Liabilities","prior":"x","latest":"x","change":"x%"},
        {"label":"Total Equity","prior":"x","latest":"x","change":"x%"},
        {"label":"Short-Term Debt","prior":"x","latest":"x","change":"x%"},
        {"label":"Long-Term Debt","prior":"x","latest":"x","change":"x%"},
        {"label":"Cash & Equivalents","prior":"x","latest":"x","change":"x%"}
      ]
    },
    "cashFlow": {
      "analysis": "Analysis of cash flow quality",
      "items": [
        {"label":"Operating Cash Flow","prior":"x","latest":"x","assessment":"x"},
        {"label":"Capital Expenditure","prior":"x","latest":"x","assessment":"x"},
        {"label":"Free Cash Flow","prior":"x","latest":"x","assessment":"x"},
        {"label":"FCF Margin","prior":"x%","latest":"x%","assessment":"x"}
      ]
    },
    "ratios": [
      {"ratio":"P/E Ratio","value":"x","industryAvg":"10-15x","assessment":"x"},
      {"ratio":"EV/EBITDA","value":"x","industryAvg":"6-9x","assessment":"x"},
      {"ratio":"ROE","value":"x%","industryAvg":"10-15%","assessment":"x"},
      {"ratio":"ROA","value":"x%","industryAvg":"5-8%","assessment":"x"},
      {"ratio":"Debt/Equity","value":"x","industryAvg":"0.4-0.8","assessment":"x"},
      {"ratio":"Current Ratio","value":"x","industryAvg":"1.5+","assessment":"x"},
      {"ratio":"Dividend Yield","value":"x%","industryAvg":"3-5%","assessment":"x"}
    ],
    "fairValue": {
      "analysis": "DCF methodology and assumptions",
      "scenarios": [
        {"scenario":"Bull Case","value":"x ${currency}","vsCurrentPrice":"+x%","probability":"20%"},
        {"scenario":"Base Case","value":"x ${currency}","vsCurrentPrice":"+x%","probability":"50%"},
        {"scenario":"Bear Case","value":"x ${currency}","vsCurrentPrice":"-x%","probability":"30%"}
      ]
    },
    "futureOutlook": {
      "coreBusinessModel": "Description of business model",
      "growthDrivers": ["driver1","driver2","driver3"],
      "disruptionRisks": ["risk1","risk2","risk3"]
    },
    "redFlags": {
      "verdict": "ok",
      "verdictText": "No significant red flags detected",
      "indicators": [
        {"indicator":"Days Sales in Receivables","observation":"x","status":"ok"},
        {"indicator":"Gross Margin Index","observation":"x","status":"ok"},
        {"indicator":"Asset Quality Index","observation":"x","status":"ok"},
        {"indicator":"Sales Growth Index","observation":"x","status":"ok"},
        {"indicator":"Depreciation Index","observation":"x","status":"ok"},
        {"indicator":"SGA Index","observation":"x","status":"ok"},
        {"indicator":"Leverage Index","observation":"x","status":"ok"},
        {"indicator":"Accruals","observation":"x","status":"ok"}
      ],
      "summary": "Summary of red flag analysis"
    },
    "risks": [
      {"title":"Risk 1","description":"x"},
      {"title":"Risk 2","description":"x"},
      {"title":"Risk 3","description":"x"},
      {"title":"Risk 4","description":"x"},
      {"title":"Risk 5","description":"x"}
    ],
    "recommendation": {
      "verdict": "hold",
      "verdictLabel": "HOLD",
      "priceTarget": "x ${currency}",
      "upside": "+x%",
      "justification": "3-4 sentence justification"
    }
  },
  "arabic": {
    "executiveSummary": "Arabic translation of executive summary",
    "revenueAnalysis": "Arabic translation of revenue analysis",
    "margins": {
      "years": ["year1","year2","year3","year4"],
      "grossMargin": ["x%","x%","x%","x%"],
      "operatingMargin": ["x%","x%","x%","x%"],
      "netMargin": ["x%","x%","x%","x%"]
    },
    "balanceSheet": {
      "analysis": "Arabic balance sheet analysis",
      "items": [
        {"label":"إجمالي الأصول","prior":"x","latest":"x","change":"x%"},
        {"label":"إجمالي الخصوم","prior":"x","latest":"x","change":"x%"},
        {"label":"إجمالي حقوق الملكية","prior":"x","latest":"x","change":"x%"},
        {"label":"الديون قصيرة الأجل","prior":"x","latest":"x","change":"x%"},
        {"label":"الديون طويلة الأجل","prior":"x","latest":"x","change":"x%"},
        {"label":"النقد والنقد المعادل","prior":"x","latest":"x","change":"x%"}
      ]
    },
    "cashFlow": {
      "analysis": "Arabic cash flow analysis",
      "items": [
        {"label":"التدفق النقدي التشغيلي","prior":"x","latest":"x","assessment":"x"},
        {"label":"النفقات الرأسمالية","prior":"x","latest":"x","assessment":"x"},
        {"label":"التدفق النقدي الحر","prior":"x","latest":"x","assessment":"x"},
        {"label":"هامش التدفق النقدي الحر","prior":"x%","latest":"x%","assessment":"x"}
      ]
    },
    "ratios": [
      {"ratio":"نسبة السعر إلى الربحية","value":"x","industryAvg":"10-15x","assessment":"x"},
      {"ratio":"قيمة المؤسسة/الأرباح","value":"x","industryAvg":"6-9x","assessment":"x"},
      {"ratio":"العائد على حقوق الملكية","value":"x%","industryAvg":"10-15%","assessment":"x"},
      {"ratio":"العائد على الأصول","value":"x%","industryAvg":"5-8%","assessment":"x"},
      {"ratio":"نسبة الدين إلى حقوق الملكية","value":"x","industryAvg":"0.4-0.8","assessment":"x"},
      {"ratio":"النسبة الجارية","value":"x","industryAvg":"1.5+","assessment":"x"},
      {"ratio":"عائد الأرباح","value":"x%","industryAvg":"3-5%","assessment":"x"}
    ],
    "fairValue": {
      "analysis": "Arabic DCF analysis",
      "scenarios": [
        {"scenario":"السيناريو الصعودي","value":"x ${currency}","vsCurrentPrice":"+x%","probability":"20%"},
        {"scenario":"السيناريو الأساسي","value":"x ${currency}","vsCurrentPrice":"+x%","probability":"50%"},
        {"scenario":"السيناريو الهبوطي","value":"x ${currency}","vsCurrentPrice":"-x%","probability":"30%"}
      ]
    },
    "futureOutlook": {
      "coreBusinessModel": "Arabic business model description",
      "growthDrivers": ["محرك1","محرك2","محرك3"],
      "disruptionRisks": ["خطر1","خطر2","خطر3"]
    },
    "redFlags": {
      "verdict": "ok",
      "verdictText": "لم يتم اكتشاف إشارات إنذار مهمة",
      "indicators": [
        {"indicator":"مؤشر أيام المبيعات في الذمم","observation":"x","status":"ok"},
        {"indicator":"مؤشر الهامش الإجمالي","observation":"x","status":"ok"},
        {"indicator":"مؤشر جودة الأصول","observation":"x","status":"ok"},
        {"indicator":"مؤشر نمو المبيعات","observation":"x","status":"ok"},
        {"indicator":"مؤشر الاستهلاك","observation":"x","status":"ok"},
        {"indicator":"مؤشر المصاريف البيعية والعمومية","observation":"x","status":"ok"},
        {"indicator":"مؤشر الرافعة المالية","observation":"x","status":"ok"},
        {"indicator":"الاستحقاقات","observation":"x","status":"ok"}
      ],
      "summary": "Arabic red flags summary"
    },
    "risks": [
      {"title":"الخطر 1","description":"x"},
      {"title":"الخطر 2","description":"x"},
      {"title":"الخطر 3","description":"x"},
      {"title":"الخطر 4","description":"x"},
      {"title":"الخطر 5","description":"x"}
    ],
    "recommendation": {
      "verdict": "hold",
      "verdictLabel": "احتفظ",
      "priceTarget": "x ${currency}",
      "upside": "+x%",
      "justification": "Arabic justification"
    }
  }
}`,
      messages: [
        {
          role: "user",
          content: `Here is the real financial data for ${symbol} fetched from FMP API. Analyze it and return the JSON report:\n\n${dataContext}`,
        },
      ],
    }),
  });

  const data = await res.json();
  console.log(`[aiReport] Claude status: ${res.status}`);

  if (!res.ok) {
    throw new Error(data?.error?.message || `Claude API error ${res.status}`);
  }

  const textBlock = data?.content?.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("Claude returned no content");

  let raw = textBlock.text.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("[aiReport] JSON parse failed:", raw.slice(0, 300));
    throw new Error("Claude output was not valid JSON");
  }

  writeCache(symbol, parsed);
  console.log(`[aiReport] report cached for ${symbol}`);
  return { report: parsed, source: "claude" };
}
