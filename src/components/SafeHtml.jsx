import React from "react";
import { sanitizeHtml } from "../utils/sanitizeHtml.js";

/**
 * Renders HTML content after sanitization to prevent XSS.
 * Use for blog content or any API/user HTML.
 */
export function SafeHtml({ html, tagName = "div", className, style }) {
  if (html == null || html === "") return null;
  const clean = sanitizeHtml(String(html));
  if (!clean) return null;
  const Tag = tagName;
  return (
    <Tag
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
