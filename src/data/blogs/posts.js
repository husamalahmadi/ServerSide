/**
 * Hardcoded copies of the original Blogger articles.
 * The wording is the archived posts. The HTML is the tutorial layout.
 */
import { blogPostPath } from "../../../shared/seo/blogPaths.js";
import { ARCHIVE_POSTS } from "./archive.js";

export const BLOG_AUTHOR = "TruePrice.Cash";

export function flattenBlogPosts() {
  return ARCHIVE_POSTS.map((post) => ({
    ...post,
    id: `${post.locale}-${post.slug}`,
    titleHtml: post.title,
    author: BLOG_AUTHOR,
    path: blogPostPath(post.locale, post.slug),
    relatedTutorial: "",
  }));
}

export function blogPostBySlug(slug, locale) {
  const loc = locale === "ar" ? "ar" : "en";
  return flattenBlogPosts().find((post) => post.slug === slug && post.locale === loc) || null;
}
