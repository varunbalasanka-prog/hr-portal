import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/public";
import { buildSite, mergeContent, type Showroom, type Site } from "./site";
import { DEFAULT_CONTENT, DEFAULT_SHOWROOMS } from "./site-defaults";
import { SITE_TAG } from "./site-tag";

/**
 * balasanka.in's content for the public pages: what varun saved on the Website page, kept for an hour and
 * refreshed at once when he saves. If the tables are not there yet (0029 not run) or the database cannot be
 * reached, the site shows the defaults in lib/site-defaults.ts, so a database problem never takes the site down.
 */
const fetchSite = unstable_cache(
  async () => {
    const db = createPublicClient();
    const [content, showrooms] = await Promise.all([
      db.from("site_content").select("key, value"),
      db.from("site_showrooms").select("*"),
    ]);
    // Throwing (instead of returning the defaults) keeps a failed read out of the cache.
    if (content.error || showrooms.error) throw new Error(content.error?.message ?? showrooms.error?.message);
    return { content: content.data ?? [], showrooms: (showrooms.data ?? []) as Showroom[] };
  },
  ["site-content-v1"],
  { tags: [SITE_TAG], revalidate: 3600 },
);

export const getSite = cache(async (): Promise<Site> => {
  try {
    const r = await fetchSite();
    return buildSite(mergeContent(DEFAULT_CONTENT, r.content), r.showrooms);
  } catch {
    return buildSite(DEFAULT_CONTENT, DEFAULT_SHOWROOMS);
  }
});
