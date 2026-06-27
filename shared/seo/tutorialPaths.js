/** Locale-prefixed tutorial URL helpers (shared by client, server, sitemap). */

export const TUTORIAL_LOCALES = ["en", "ar"];

export function tutorialIndexPath(locale = "en") {
  const loc = locale === "ar" ? "ar" : "en";
  return `/${loc}/tutorials`;
}

export function tutorialArticlePath(locale, slug) {
  const loc = locale === "ar" ? "ar" : "en";
  return `/${loc}/tutorials/${encodeURIComponent(String(slug || "").trim())}`;
}

export function parseTutorialPath(pathname) {
  const path = String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  const indexMatch = path.match(/^\/(en|ar)\/tutorials\/?$/i);
  if (indexMatch) return { locale: indexMatch[1].toLowerCase(), slug: null };
  const articleMatch = path.match(/^\/(en|ar)\/tutorials\/([^/]+)\/?$/i);
  if (articleMatch) {
    return {
      locale: articleMatch[1].toLowerCase(),
      slug: decodeURIComponent(articleMatch[2]),
    };
  }
  return null;
}

export function localizeTutorialBodyHtml(html, locale = "en") {
  if (typeof html !== "string" || !html) return html;
  const loc = locale === "ar" ? "ar" : "en";
  return html.replace(/href="\/tutorials\//g, `href="/${loc}/tutorials/`);
}
