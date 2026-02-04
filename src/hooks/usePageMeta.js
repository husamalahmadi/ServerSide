import { useEffect } from "react";

const DEFAULT_TITLE = "Trueprice.cash";
const DEFAULT_DESC = "Stock fair value, financial statements, and fundamentals. US and Saudi markets.";

function setMeta(name, content, isProperty = false) {
  const attr = isProperty ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content || "");
}

/**
 * Sets document.title and meta description + og tags for the current page.
 * Call from each route with page-specific title and description.
 */
export function usePageMeta({ title, description } = {}) {
  useEffect(() => {
    const newTitle = title ? `${title} – Trueprice.cash` : DEFAULT_TITLE;
    const newDesc = description || DEFAULT_DESC;

    document.title = newTitle;
    setMeta("description", newDesc);
    setMeta("og:title", newTitle, true);
    setMeta("og:description", newDesc, true);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta("description", DEFAULT_DESC);
      setMeta("og:title", DEFAULT_TITLE, true);
      setMeta("og:description", DEFAULT_DESC, true);
    };
  }, [title, description]);
}
