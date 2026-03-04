/**
 * Vercel serverless function to proxy Google News RSS.
 * Bypasses CORS by fetching server-side.
 */
export default async function handler(req, res) {
  const url = req.query.url;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TruepriceBot/1.0)" },
    });
    if (!response.ok) {
      res.status(response.status).send(`Upstream error: ${response.status}`);
      return;
    }
    const text = await response.text();
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(text);
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
}
