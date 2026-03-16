/**
 * Analytics API - receives events and appends to JSON file.
 * Used by both Vite dev middleware and production Express server.
 */
import fs from "fs";
import path from "path";

const ANALYTICS_FILE = path.join(process.cwd(), "data", "analytics.json");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readEvents() {
  ensureDir(path.dirname(ANALYTICS_FILE));
  if (!fs.existsSync(ANALYTICS_FILE)) {
    return { events: [], totalHits: 0 };
  }
  try {
    const raw = fs.readFileSync(ANALYTICS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { events: [], totalHits: 0 };
  }
}

export function appendEvent(event, clientIp) {
  const data = readEvents();
  const enriched = {
    ...event,
    serverIp: clientIp || event.ip || null,
  };
  data.events.push(enriched);
  if (event.type === "page_hit") {
    data.totalHits = (data.totalHits || 0) + 1;
  }
  ensureDir(path.dirname(ANALYTICS_FILE));
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2), "utf8");
  return data;
}

export function handleAnalyticsPost(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    try {
      const event = JSON.parse(body);
      const clientIp =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.headers["x-real-ip"] ||
        req.socket?.remoteAddress ||
        null;
      appendEvent(event, clientIp);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
  });
}

export function handleAnalyticsGet(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  try {
    const data = readEvents();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data, null, 2));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Failed to read analytics" }));
  }
}
