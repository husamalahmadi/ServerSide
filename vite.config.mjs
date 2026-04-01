import { cpSync, existsSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Runs inside `vite build` even when the host uses `vite build` instead of `npm run build`. */
function copyOutputToDistForPages() {
  return {
    name: "copy-output-to-dist",
    closeBundle() {
      if (!existsSync("dist") && existsSync("output")) {
        cpSync("output", "dist", { recursive: true });
        console.log("[vite] Copied output/ → dist/ (Cloudflare Pages expects dist/).");
      }
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [react(), copyOutputToDistForPages()],
  server: {
    port: 5173,
    open: true, // Automatically open browser
    strictPort: false, // Try next available port if 5173 is taken
  },
  build: {
    // Default `dist` matches Vercel/Cloudflare docs; avoids deploying empty `dist` on Pages.
    outDir: "dist",
    emptyOutDir: true,
  },
});
