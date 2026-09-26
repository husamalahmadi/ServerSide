import { blogPostBySlug, flattenBlogPosts } from "../data/blogs/posts.js";

/** Hardcoded posts from src/data/blogs/posts.js. */
export function loadBlogPosts() {
  return flattenBlogPosts();
}

export function findBlogPost(slug, locale) {
  return blogPostBySlug(slug, locale);
}
