/**
 * Vite plugin - adds /api/analytics endpoint for dev server.
 */
import { handleAnalyticsPost, handleAnalyticsGet } from "./server/analyticsApi.js";

export function analyticsPlugin() {
  return {
    name: "analytics-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/api/analytics" && req.method === "POST") {
          handleAnalyticsPost(req, res);
          return;
        }
        if (req.url === "/api/analytics" && req.method === "GET") {
          handleAnalyticsGet(req, res);
          return;
        }
        next();
      });
    },
  };
}
