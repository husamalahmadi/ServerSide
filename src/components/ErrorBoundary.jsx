import React from "react";
import { logger } from "../utils/logger.js";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const fallback = this.props.fallback;
      if (typeof fallback === "function") return fallback(this.state.error);
      if (fallback) return fallback;
      return (
        <div
          style={{
            padding: 24,
            maxWidth: 560,
            margin: "40px auto",
            background: "#fff",
            border: "1px solid #fecaca",
            borderRadius: 12,
            color: "#991b1b",
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Something went wrong</h2>
          <p style={{ margin: 0, fontSize: 14 }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 16,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #b91c1c",
              background: "#fef2f2",
              color: "#991b1b",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
