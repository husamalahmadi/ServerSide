/**
 * Production server - serves built app and analytics API.
 * Run: node server/index.js (after npm run build)
 */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { appendEvent, handleAnalyticsGet } from "./analyticsApi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, "..", "output");

app.use(express.json({ limit: "10kb" }));

app.post("/api/analytics", (req, res) => {
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    null;
  const event = req.body;
  if (!event || typeof event !== "object") {
    return res.status(400).json({ error: "Invalid body" });
  }
  try {
    appendEvent(event, clientIp);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/analytics", (req, res) => {
  handleAnalyticsGet(req, res);
});

app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Analytics data: data/analytics.json`);
});
