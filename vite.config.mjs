import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { analyticsPlugin } from "./vite-plugin-analytics.mjs";

export default defineConfig({
  base: "/",
  plugins: [react(), analyticsPlugin()],
  server: {
    port: 5173,
    open: true, // Automatically open browser
    strictPort: false, // Try next available port if 5173 is taken
  },
  build: {
    outDir: "output",
    emptyOutDir: true,
  },
});
