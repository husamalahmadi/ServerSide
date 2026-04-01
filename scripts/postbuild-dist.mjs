/**
 * Cloudflare Pages / other hosts expect build output in `dist/`.
 * Older vite.config used `outDir: "output"` — copy that folder to `dist` when needed.
 */
import { cpSync, existsSync } from "node:fs";

if (!existsSync("dist") && existsSync("output")) {
  cpSync("output", "dist", { recursive: true });
  console.log("[postbuild-dist] Copied output/ → dist/ for static hosting.");
}
