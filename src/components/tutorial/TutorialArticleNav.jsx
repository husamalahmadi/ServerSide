import React from "react";
import { Link } from "react-router-dom";

export function TutorialArticleNav({ prev, next, t }) {
  if (!prev && !next) return null;
  const prevLabel = t?.("TUTORIALS_NAV_PREV") || "Previous";
  const nextLabel = t?.("TUTORIALS_NAV_NEXT") || "Next tutorial";

  return (
    <nav className="tp-tutorial-nav" aria-label={t?.("TUTORIALS_NAV_ARIA") || "Tutorial series navigation"}>
      {prev ? (
        <Link
          to={`/tutorials/${prev.slug}`}
          className="tp-tutorial-nav-pill tp-tutorial-nav-pill--prev"
        >
          <span className="tp-tutorial-nav-dir">{prevLabel}</span>
          <span className="tp-tutorial-nav-title">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          to={`/tutorials/${next.slug}`}
          className="tp-tutorial-nav-pill tp-tutorial-nav-pill--next"
        >
          <span className="tp-tutorial-nav-dir">{nextLabel}</span>
          <span className="tp-tutorial-nav-title">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
