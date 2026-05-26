import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const serverDir = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(serverDir, "data", "cache");
const CACHE_FILE = join(CACHE_DIR, "home-signals.json");

/** Home signals disk + in-memory TTL (1 hour). */
export const HOME_SIGNALS_TTL_MS = 60 * 60_000;

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

export function readHomeSignalsDisk() {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
    if (!raw?.data || !raw?.cachedAt) return null;
    if (Date.now() - raw.cachedAt > HOME_SIGNALS_TTL_MS) return null;
    return raw.data;
  } catch {
    return null;
  }
}

export function writeHomeSignalsDisk(data) {
  ensureCacheDir();
  writeFileSync(
    CACHE_FILE,
    JSON.stringify({ cachedAt: Date.now(), data }, null, 0),
    "utf8"
  );
}

/** Serve cached payload from disk when fresh; otherwise build and persist. */
export async function getHomeSignals(buildFn) {
  const disk = readHomeSignalsDisk();
  if (disk) return disk;
  const data = await buildFn();
  writeHomeSignalsDisk(data);
  return data;
}
