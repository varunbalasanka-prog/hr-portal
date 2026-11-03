import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/public";
import { byDate, parsePost, postFromRow, type Post } from "./blog-format";
import { SITE_TAG } from "./site-tag";
export * from "./blog-format";

/**
 * Where the blog's posts come from. varun writes them on the Website page (site_posts table, drafts hidden by the
 * database). Until 0029 has been run, or if the database cannot be reached, the starter posts in content/blog/*.md show.
 */

const DIR = path.join(process.cwd(), "content", "blog");

/** The starter posts in content/blog, newest first. Posts dated in the future stay hidden. */
export function filePosts(): Post[] {
  const today = new Date().toISOString().slice(0, 10);
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parsePost(f.slice(0, -3), readFileSync(path.join(DIR, f), "utf8")))
    .filter((p) => p.date <= today)
    .sort(byDate);
}

const fetchPosts = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient()
      .from("site_posts").select("slug, title, description, category, body, published_on, checked_on");
    if (error || !data) throw new Error(error?.message ?? "no posts");
    return data;
  },
  ["site-posts-v1"],
  { tags: [SITE_TAG], revalidate: 3600 },
);

/** Every published post, newest first. */
export const allPosts = cache(async (): Promise<Post[]> => {
  try {
    return (await fetchPosts()).map(postFromRow).sort(byDate);
  } catch {
    return filePosts();
  }
});

export const findPost = async (slug: string) => (await allPosts()).find((p) => p.slug === slug);
