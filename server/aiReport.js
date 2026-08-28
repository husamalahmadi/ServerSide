/**
 * aiReport.js
 * Calls the Claude Managed Agent to generate a bilingual investment report.
 * Caches results in SQLite for 7 days.
 */

import Database from "better-sqlite3";

const AGENT_ID = process.env.CLAUDE_AGENT_ID || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_BASE = "https://api.anthropic.com";
const AGENT_API_VERSION = "2023-06-01";
const AGENT_BETA = "interleaved-thinking-2025-05-14,files-api-2025-04-14,mcp-client-2025-04-04,agents-2025-04-21";
const CACHE_TTL_SEC = 7 * 24 * 60 * 60;

let _db = null;
function getDb() {
  if (_db) return _db;
  const dbPath = process.env.DB_PATH || "/var/data/trueprice.db";
  _db = new Database(dbPath);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS ai_reports (
      symbol      TEXT PRIMARY KEY,
      report_json TEXT NOT NULL,
      generated_at INTEGER NOT NULL
    )
  `);
  return _db;
}

function readCached(symbol) {
  try {
    const db = getDb();
    const row = db.prepare("SELECT report_json, generated_at FROM ai_reports WHERE symbol = ?").get(symbol);
    if (!row) return null;
    const age = Math.floor(Date.now() / 1000) - row.generated_at;
    if (age > CACHE_TTL_SEC) return null;
    return JSON.parse(row.report_json);
  } catch {
    return null;
  }
}

function writeCache(symbol, reportJson) {
  try {
    const db = getDb();
    db.prepare(
      "INSERT OR REPLACE INTO ai_reports (symbol, report_json, generated_at) VALUES (?, ?, ?)"
    ).run(symbol, JSON.stringify(reportJson), Math.floor(Date.now() / 1000));
  } catch (e) {
    console.warn("[aiReport] cache write failed:", e.message);
  }
}

async function agentFetch(path, method = "GET", body = null) {
  const res = await fetch(`${ANTHROPIC_BASE}${path}`, {
    method,
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": AGENT_API_VERSION,
      "anthropic-beta": AGENT_BETA,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Agent API error ${res.status}`);
  return data;
}

export async function generateAiReport(symbol, forceRefresh = false) {
  if (!AGENT_ID) throw new Error("CLAUDE_AGENT_ID env var not set");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY env var not set");

  if (!forceRefresh) {
    const cached = readCached(symbol);
    if (cached) {
      console.log(`[aiReport] cache hit for ${symbol}`);
      return { report: cached, source: "cache" };
    }
  }

  console.log(`[aiReport] generating report for ${symbol} via Claude agent...`);

  const session = await agentFetch(`/v1/agents/${AGENT_ID}/sessions`, "POST", {
    session_name: `report-${symbol}-${Date.now()}`,
  });
  const sessionId = session.id;

  const msgRes = await agentFetch(
    `/v1/agents/${AGENT_ID}/sessions/${sessionId}/messages`,
    "POST",
    {
      model: "claude-sonnet-4-20250514",
      messages: [
        {
          role: "user",
          content: `Generate a full investment report for stock symbol ${symbol}. Return only the JSON object as specified in your instructions.`,
        },
      ],
      max_tokens: 8000,
    }
  );

  const textBlock = msgRes?.content?.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("Agent returned no text content");

  let raw = textBlock.text.trim();
  raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("[aiReport] JSON parse failed. Raw output:", raw.slice(0, 500));
    throw new Error("Agent output was not valid JSON");
  }

  writeCache(symbol, parsed);
  console.log(`[aiReport] report generated and cached for ${symbol}`);
  return { report: parsed, source: "agent" };
}
