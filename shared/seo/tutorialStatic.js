import { tutorialArticlePath, tutorialIndexPath, localizeTutorialBodyHtml } from "./tutorialPaths.js";

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTitle(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function siteNav(locale) {
  const isAr = locale === "ar";
  return `<nav aria-label="${isAr ? "الموقع" : "Site"}">
        <a href="/">${isAr ? "الرئيسية" : "Home"}</a>
        <a href="${tutorialIndexPath(locale)}">${isAr ? "الدروس" : "Tutorials"}</a>
        <a href="/blogs">${isAr ? "المدونة" : "Blogs"}</a>
        <a href="/about">${isAr ? "من نحن" : "About"}</a>
        <a href="/contact">${isAr ? "اتصل بنا" : "Contact"}</a>
        <a href="/sitemap.xml">Sitemap</a>
      </nav>`;
}

/**
 * Crawler-visible block injected into SPA index.html (tp-static-fallback).
 */
export function buildTutorialSpaStaticFallback({ locale, article, articles, indexSeo }) {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";

  if (article) {
    const title = stripTitle(article.titleHtml);
    const body = localizeTutorialBodyHtml(article.bodyHtml || "", locale);
    const prev = article.prev
      ? `<a href="${tutorialArticlePath(locale, article.prev.slug)}">${escapeHtml(article.prev.title)}</a>`
      : "";
    const next = article.next
      ? `<a href="${tutorialArticlePath(locale, article.next.slug)}">${escapeHtml(article.next.title)}</a>`
      : "";

    return `<main id="tp-static-fallback" class="tp-static-shell tp-tutorial-static" dir="${dir}" lang="${locale}" aria-hidden="true">
      <h1 class="tp-static-hero">${escapeHtml(title)}</h1>
      <p class="tp-static-subhead">${escapeHtml(article.subtitle || "")}</p>
      <article class="tp-tutorial-content">${body}</article>
      <nav class="tp-tutorial-static-nav">${prev}${next}</nav>
      ${siteNav(locale)}
    </main>`;
  }

  const listItems = (articles || [])
    .map((a) => {
      const title = stripTitle(a.titleHtml);
      return `<li><a href="${tutorialArticlePath(locale, a.slug)}">${escapeHtml(title)}</a></li>`;
    })
    .join("\n        ");

  const heading = indexSeo?.title || (isAr ? "دروس التحليل الأساسي" : "Fundamental Analysis Tutorials");

  return `<main id="tp-static-fallback" class="tp-static-shell tp-tutorial-static" dir="${dir}" lang="${locale}" aria-hidden="true">
      <h1 class="tp-static-hero">${escapeHtml(heading)}</h1>
      <p class="tp-static-subhead">${escapeHtml(indexSeo?.metaDescription || indexSeo?.description || "")}</p>
      <ol class="tp-tutorial-static-catalog">${listItems}</ol>
      ${siteNav(locale)}
    </main>`;
}
