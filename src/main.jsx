import React from "react";
import ReactDOM from "react-dom/client";

// Strip legacy ?auth=api_required again before React (defense in depth vs cached bundles).
try {
  const u = new URL(window.location.href);
  if (u.searchParams.get("auth") === "api_required") {
    u.searchParams.delete("auth");
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  }
} catch {
  /* ignore */
}
import "./index.css";
import App from "./routes/App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
