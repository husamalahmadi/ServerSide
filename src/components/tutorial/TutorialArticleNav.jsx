import React from "react";
import { Link } from "react-router-dom";

export function TutorialArticleNav({ prev, next }) {
  if (!prev && !next) return null;
  return (
    <nav className="tp-tutorial-nav" aria-label="Tutorial series navigation">
      {prev ? (
        <Link to={`/tutorials/${prev.slug}`} className="tp-tutorial-nav-pill tp-tutorial-nav-pill--prev">
          <span className="tp-tutorial-nav-dir">Previous</span>
          <span className="tp-tutorial-nav-title">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to={`/tutorials/${next.slug}`} className="tp-tutorial-nav-pill tp-tutorial-nav-pill--next">
          <span className="tp-tutorial-nav-dir">Next tutorial</span>
          <span className="tp-tutorial-nav-title">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
