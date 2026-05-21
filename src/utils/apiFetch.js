/**
 * Parse fetch responses that must be JSON (API routes).
 * Surfaces HTML/gateway pages as clear errors instead of "Bad JSON".
 */
export async function readJsonResponse(res, label = "API") {
  const txt = await res.text();
  const trimmed = txt.trim();

  if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
    const hint =
      res.status === 502 || res.status === 503
        ? " The API server may be starting up or misconfigured — check VITE_API_URL / runtime-config.js."
        : " The request may have hit the static site instead of the API host.";
    throw new Error(`${label}: server returned HTML (${res.status}), not JSON.${hint}`);
  }

  let json = {};
  try {
    json = trimmed ? JSON.parse(trimmed) : {};
  } catch {
    throw new Error(`${label}: invalid JSON (${res.status}): ${trimmed.slice(0, 120)}`);
  }

  if (!res.ok) {
    throw new Error(json?.error || json?.message || `${label}: HTTP ${res.status}`);
  }

  return json;
}
