/**
 * Vercel serverless API for analytics.
 * POST: record event, GET: return analytics data.
 * Requires Vercel Blob store (create in Vercel dashboard, token auto-injected).
 */
import { list, get, put } from "@vercel/blob";

const BLOB_PATH = "analytics.json";

async function readData() {
  try {
    const { blobs } = await list({ prefix: "analytics" });
    const blob = blobs.find((b) => b.pathname === BLOB_PATH);
    if (!blob) return { events: [], totalHits: 0 };
    const res = await get(blob.url);
    const text = await res.text();
    return JSON.parse(text || "{}");
  } catch {
    return { events: [], totalHits: 0 };
  }
}

async function writeData(data) {
  const json = JSON.stringify(data, null, 2);
  await put(BLOB_PATH, json, {
    access: "private",
    allowOverwrite: true,
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    try {
      const data = await readData();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: "Failed to read analytics" });
    }
  }

  if (req.method === "POST") {
    try {
      const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const clientIp =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.headers["x-real-ip"] ||
        null;
      const data = await readData();
      const enriched = { ...event, serverIp: clientIp || event.ip || null };
      data.events = data.events || [];
      data.events.push(enriched);
      if (event.type === "page_hit") {
        data.totalHits = (data.totalHits || 0) + 1;
      }
      await writeData(data);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(400).json({ error: "Invalid request" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
