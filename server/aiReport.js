import Database from "better-sqlite3";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const FMP_API_KEY = process.env.FMP_API_KEY || "";
const CACHE_TTL_SEC = 7 * 24 * 60 * 60;

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
  } catch {
    return null;
  }
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

export async function generateAiReport(symbol, forceRefresh = false) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  console.log(`[aiReport] symbol=${symbol} key_set=${!!ANTHROPIC_API_KEY} fmp_set=${!!FMP_API_KEY}`);

  if (!forceRefresh) {
    const cached = readCached(symbol);
    if (cached) {
      console.log(`[aiReport] cache hit ${symbol}`);
      return { report: cached, source: "cache" };
    }
  }

  console.log(`[aiReport] calling Claude API for ${symbol}...`);

  const systemPrompt = `You are a financial analyst for TruePrice.Cash. Given a stock symbol, analyze financial data from FMP and return a bilingual JSON investment report.

Use these FMP endpoints (replace SYMBOL with actual symbol):
https://financialmodelingprep.com/stable/income-statement?symbol=SYMBOL&apikey=${FMP_API_KEY}
https://financialmodelingprep.com/stable/balance-sheet-statement?symbol=SYMBOL&apikey=${FMP_API_KEY}
https://financialmodelingprep.com/stable/cash-flow-statement?symbol=SYMBOL&apikey=${FMP_API_KEY}

Symbol rules:
- Saudi TASI numbers (like 3003): add .SR → 3003.SR
- US stocks: no suffix → AAPL
- Japan: add .T
- UK: add .L

Return ONLY a valid JSON object — no markdown, no explanation. Structure:
{
  "symbol": "3003.SR",
  "companyName": "City Cement Company",
  "reportDate": "2026-08-28",
  "currentPrice": "SAR 20.00",
  "currency": "SAR",
  "charts": {
    "years": ["2022","2023","2024","2025"],
    "revenue": [1.2, 1.4, 1.5, 1.3],
    "operatingIncome": [0.2, 0.3, 0.25, 0.2],
    "operatingCashFlow": [0.3, 0.35, 0.28, 0.22]
  },
  "english": {
    "executiveSummary": "...",
    "revenueAnalysis": "...",
    "margins": {
      "years": ["2022","2023","2024","2025"],
      "grossMargin": ["20%","22%","21%","19%"],
      "operatingMargin": ["15%","18%","16%","14%"],
      "netMargin": ["10%","12%","11%","9%"]
    },
    "balanceSheet": {
      "analysis": "...",
      "items": [
        {"label": "Total Assets", "prior": "SAR 2.1B", "latest": "SAR 2.3B", "change": "+10%"},
        {"label": "Total Liabilities", "prior": "SAR 0.8B", "latest": "SAR 0.9B", "change": "+12%"},
        {"label": "Total Equity", "prior": "SAR 1.3B", "latest": "SAR 1.4B", "change": "+8%"},
        {"label": "Short-Term Debt", "prior": "SAR 0.1B", "latest": "SAR 0.15B", "change": "+50%"},
        {"label": "Long-Term Debt", "prior": "SAR 0.3B", "latest": "SAR 0.28B", "change": "-7%"},
        {"label": "Cash & Equivalents", "prior": "SAR 0.4B", "latest": "SAR 0.35B", "change": "-12%"}
      ]
    },
    "cashFlow": {
      "analysis": "...",
      "items": [
        {"label": "Operating Cash Flow", "prior": "SAR 0.28B", "latest": "SAR 0.22B", "assessment": "Declining"},
        {"label": "Capital Expenditure", "prior": "SAR 0.05B", "latest": "SAR 0.04B", "assessment": "Low"},
        {"label": "Free Cash Flow", "prior": "SAR 0.23B", "latest": "SAR 0.18B", "assessment": "Positive"},
        {"label": "FCF Margin", "prior": "15%", "latest": "14%", "assessment": "Healthy"}
      ]
    },
    "ratios": [
      {"ratio": "P/E Ratio", "value": "12x", "industryAvg": "10-15x", "assessment": "Fair"},
      {"ratio": "EV/EBITDA", "value": "7x", "industryAvg": "6-9x", "assessment": "Fair"},
      {"ratio": "ROE", "value": "12%", "industryAvg": "10-15%", "assessment": "Good"},
      {"ratio": "ROA", "value": "6%", "industryAvg": "5-8%", "assessment": "Good"},
      {"ratio": "Debt/Equity", "value": "0.3", "industryAvg": "0.4-0.8", "assessment": "Conservative"},
      {"ratio": "Current Ratio", "value": "1.8", "industryAvg": "1.5+", "assessment": "Adequate"},
      {"ratio": "Dividend Yield", "value": "4%", "industryAvg": "3-5%", "assessment": "Attractive"}
    ],
    "fairValue": {
      "analysis": "...",
      "scenarios": [
        {"scenario": "Bull Case", "value": "SAR 25", "vsCurrentPrice": "+25%", "probability": "20%"},
        {"scenario": "Base Case", "value": "SAR 21", "vsCurrentPrice": "+5%", "probability": "50%"},
        {"scenario": "Bear Case", "value": "SAR 16", "vsCurrentPrice": "-20%", "probability": "30%"}
      ]
    },
    "futureOutlook": {
      "coreBusinessModel": "...",
      "growthDrivers": ["Vision 2030 construction boom", "Expanding capacity", "Strong domestic demand"],
      "disruptionRisks": ["Raw material cost inflation", "Regional competition", "Regulatory changes"]
    },
    "redFlags": {
      "verdict": "ok",
      "verdictText": "No significant red flags detected",
      "indicators": [
        {"indicator": "Days Sales in Receivables", "observation": "DSO stable", "status": "ok"},
        {"indicator": "Gross Margin Index", "observation": "Margins stable", "status": "ok"},
        {"indicator": "Asset Quality Index", "observation": "Assets growing", "status": "ok"},
        {"indicator": "Sales Growth Index", "observation": "Moderate growth", "status": "ok"},
        {"indicator": "Depreciation Index", "observation": "Consistent", "status": "ok"},
        {"indicator": "SGA Index", "observation": "Controlled", "status": "ok"},
        {"indicator": "Leverage Index", "observation": "Conservative", "status": "ok"},
        {"indicator": "Accruals", "observation": "OCF supports earnings", "status": "ok"}
      ],
      "summary": "..."
    },
    "risks": [
      {"title": "Raw Material Costs", "description": "..."},
      {"title": "Competition", "description": "..."},
      {"title": "Regulatory", "description": "..."},
      {"title": "Economic Slowdown", "description": "..."},
      {"title": "FX Risk", "description": "..."}
    ],
    "recommendation": {
      "verdict": "hold",
      "verdictLabel": "HOLD",
      "priceTarget": "SAR 21",
      "upside": "+5%",
      "justification": "..."
    }
  },
  "arabic": {
    "executiveSummary": "...",
    "revenueAnalysis": "...",
    "margins": {
      "years": ["2022","2023","2024","2025"],
      "grossMargin": ["20%","22%","21%","19%"],
      "operatingMargin": ["15%","18%","16%","14%"],
      "netMargin": ["10%","12%","11%","9%"]
    },
    "balanceSheet": {
      "analysis": "...",
      "items": [
        {"label": "إجمالي الأصول", "prior": "2.1 مليار ريال", "latest": "2.3 مليار ريال", "change": "+10%"},
        {"label": "إجمالي الخصوم", "prior": "0.8 مليار ريال", "latest": "0.9 مليار ريال", "change": "+12%"},
        {"label": "إجمالي حقوق الملكية", "prior": "1.3 مليار ريال", "latest": "1.4 مليار ريال", "change": "+8%"},
        {"label": "الديون قصيرة الأجل", "prior": "0.1 مليار ريال", "latest": "0.15 مليار ريال", "change": "+50%"},
        {"label": "الديون طويلة الأجل", "prior": "0.3 مليار ريال", "latest": "0.28 مليار ريال", "change": "-7%"},
        {"label": "النقد والنقد المعادل", "prior": "0.4 مليار ريال", "latest": "0.35 مليار ريال", "change": "-12%"}
      ]
    },
    "cashFlow": {
      "analysis": "...",
      "items": [
        {"label": "التدفق النقدي التشغيلي", "prior": "0.28 مليار ريال", "latest": "0.22 مليار ريال", "assessment": "متراجع"},
        {"label": "النفقات الرأسمالية", "prior": "0.05 مليار ريال", "latest": "0.04 مليار ريال", "assessment": "منخفض"},
        {"label": "التدفق النقدي الحر", "prior": "0.23 مليار ريال", "latest": "0.18 مليار ريال", "assessment": "إيجابي"},
        {"label": "هامش التدفق النقدي الحر", "prior": "15%", "latest": "14%", "assessment": "صحي"}
      ]
    },
    "ratios": [
      {"ratio": "نسبة السعر إلى الربحية", "value": "12x", "industryAvg": "10-15x", "assessment": "عادل"},
      {"ratio": "قيمة المؤسسة/الأرباح", "value": "7x", "industryAvg": "6-9x", "assessment": "عادل"},
      {"ratio": "العائد على حقوق الملكية", "value": "12%", "industryAvg": "10-15%", "assessment": "جيد"},
      {"ratio": "العائد على الأصول", "value": "6%", "industryAvg": "5-8%", "assessment": "جيد"},
      {"ratio": "نسبة الدين إلى حقوق الملكية", "value": "0.3", "industryAvg": "0.4-0.8", "assessment": "محافظ"},
      {"ratio": "النسبة الجارية", "value": "1.8", "industryAvg": "1.5+", "assessment": "كافية"},
      {"ratio": "عائد الأرباح", "value": "4%", "industryAvg": "3-5%", "assessment": "جذاب"}
    ],
    "fairValue": {
      "analysis": "...",
      "scenarios": [
        {"scenario": "السيناريو الصعودي", "value": "25 ريال", "vsCurrentPrice": "+25%", "probability": "20%"},
        {"scenario": "السيناريو الأساسي", "value": "21 ريال", "vsCurrentPrice": "+5%", "probability": "50%"},
        {"scenario": "السيناريو الهبوطي", "value": "16 ريال", "vsCurrentPrice": "-20%", "probability": "30%"}
      ]
    },
    "futureOutlook": {
      "coreBusinessModel": "...",
      "growthDrivers": ["طفرة البناء في رؤية 2030", "توسعة الطاقة الإنتاجية", "قوة الطلب المحلي"],
      "disruptionRisks": ["ارتفاع تكاليف المواد الخام", "المنافسة الإقليمية", "التغييرات التنظيمية"]
    },
    "redFlags": {
      "verdict": "ok",
      "verdictText": "لم يتم اكتشاف إشارات إنذار مهمة",
      "indicators": [
        {"indicator": "مؤشر أيام المبيعات في الذمم", "observation": "DSO مستقر", "status": "ok"},
        {"indicator": "مؤشر الهامش الإجمالي", "observation": "الهوامش مستقرة", "status": "ok"},
        {"indicator": "مؤشر جودة الأصول", "observation": "الأصول في نمو", "status": "ok"},
        {"indicator": "مؤشر نمو المبيعات", "observation": "نمو معتدل", "status": "ok"},
        {"indicator": "مؤشر الاستهلاك", "observation": "متسق", "status": "ok"},
        {"indicator": "مؤشر المصاريف البيعية والعمومية", "observation": "تحت السيطرة", "status": "ok"},
        {"indicator": "مؤشر الرافعة المالية", "observation": "محافظ", "status": "ok"},
        {"indicator": "الاستحقاقات", "observation": "التدفق النقدي يدعم الأرباح", "status": "ok"}
      ],
      "summary": "..."
    },
    "risks": [
      {"title": "تكاليف المواد الخام", "description": "..."},
      {"title": "المنافسة", "description": "..."},
      {"title": "التنظيم", "description": "..."},
      {"title": "التباطؤ الاقتصادي", "description": "..."},
      {"title": "مخاطر العملة", "description": "..."}
    ],
    "recommendation": {
      "verdict": "hold",
      "verdictLabel": "احتفظ",
      "priceTarget": "21 ريال",
      "upside": "+5%",
      "justification": "..."
    }
  }
}

Fill ALL fields marked with "..." with real analysis based on actual FMP data. Replace all placeholder numbers with real numbers from FMP. Return only the JSON.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate a complete investment report for stock symbol ${symbol}. Fetch real data from the FMP URLs in your instructions. Return ONLY the raw JSON object. Do not include any text, explanation, or markdown before or after the JSON. Start your response with { and end with }`,
        },
        {
          role: "assistant",
          content: "{",
        },
      ],
    }),
  });

  const data = await res.json();
  console.log(`[aiReport] Claude status: ${res.status}`, JSON.stringify(data?.error || "ok").slice(0, 200));

  if (!res.ok) {
    throw new Error(data?.error?.message || `Claude API error ${res.status}`);
  }

  const textBlock = data?.content?.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("Claude returned no content");

  let raw = textBlock.text.trim();
  // Add back the { we used as prefill
  raw = "{" + raw;
  // Remove any trailing markdown
  raw = raw.replace(/\s*```$/i, "").trim();

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
