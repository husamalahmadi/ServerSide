import { cpSync, existsSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Vite build output next to Express (server/static). Avoids cwd/../dist confusion on Render. */
const OUT_DIR = "server/static";

/** If legacy output/ exists and build skipped, copy into OUT_DIR (Pages / older scripts). */
function copyOutputFallback() {
  return {
    name: "copy-output-fallback",
    closeBundle() {
      if (!existsSync(OUT_DIR) && existsSync("output")) {
        cpSync("output", OUT_DIR, { recursive: true });
        console.log(`[vite] Copied output/ → ${OUT_DIR}/`);
      }
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [react(), copyOutputFallback()],
  server: {
    port: 5173,
    open: true,
    strictPort: false,
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
  },
});
