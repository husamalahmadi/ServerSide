/** Resolve localized tutorial fields for display. */

function stripTitle(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tutorialLocale(article, lang = "en") {
  if (!article) return null;
  if (article.locales) {
    return article.locales[lang] || article.locales.en || null;
  }
  return article;
}

export function resolveTutorialArticle(article, lang, allArticles = []) {
  const loc = tutorialLocale(article, lang);
  if (!loc) return null;

  const idx = allArticles.findIndex((a) => a.slug === article.slug);
  const prevArticle = idx > 0 ? allArticles[idx - 1] : null;
  const nextArticle = idx >= 0 && idx < allArticles.length - 1 ? allArticles[idx + 1] : null;

  const prevLoc = prevArticle ? tutorialLocale(prevArticle, lang) : null;
  const nextLoc = nextArticle ? tutorialLocale(nextArticle, lang) : null;

  return {
    slug: article.slug,
    order: article.order,
    ...loc,
    prev: loc.prev || (prevLoc ? { slug: prevArticle.slug, title: stripTitle(prevLoc.titleHtml) } : null),
    next: loc.next || (nextLoc ? { slug: nextArticle.slug, title: stripTitle(nextLoc.titleHtml) } : null),
  };
}

export function resolveTutorialArticles(articles, lang) {
  return articles.map((a) => resolveTutorialArticle(a, lang, articles)).filter(Boolean);
}
