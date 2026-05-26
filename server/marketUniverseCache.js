import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const serverDir = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(serverDir, "data", "cache");

export const MARKET_UNIVERSE_TTL_MS = 20 * 60_000;

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

/** Read disk cache if younger than TTL. */
export function readMarketUniverseDisk(market) {
  const file = join(CACHE_DIR, `${market}-universe.json`);
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    if (!raw?.data || !raw?.cachedAt) return null;
    if (Date.now() - raw.cachedAt > MARKET_UNIVERSE_TTL_MS) return null;
    return raw.data;
  } catch {
    return null;
  }
}

/** Persist universe payload (with updatedAt inside data). */
export function writeMarketUniverseDisk(market, data) {
  ensureCacheDir();
  const file = join(CACHE_DIR, `${market}-universe.json`);
  writeFileSync(
    file,
    JSON.stringify({ cachedAt: Date.now(), data }, null, 0),
    "utf8"
  );
}
