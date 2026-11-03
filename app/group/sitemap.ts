import type { MetadataRoute } from "next";
import { allPosts } from "@/lib/blog";
import { GROUP_SITE, SHOWROOM_GROUPS, TOWNS, townSlug } from "@/lib/group";

/** balasanka.in's own sitemap (served at balasanka.in/sitemap.xml by the middleware). Job pages stay in hr.balasanka.in's sitemap. */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number) => ({ url: `${GROUP_SITE}${path}`, changeFrequency: "monthly" as const, priority });
  return [
    page("/", 1),
    ...SHOWROOM_GROUPS.map((g) => page(`/${g.slug}`, 0.9)),
    page("/showrooms", 0.9),
    ...TOWNS.map((t) => page(`/showrooms/${townSlug(t)}`, 0.8)),
    page("/about", 0.7),
    page("/contact", 0.6),
    page("/blog", 0.7),
    ...allPosts().map((p) => ({ url: `${GROUP_SITE}/blog/${p.slug}`, lastModified: p.updated ?? p.date, changeFrequency: "yearly" as const, priority: 0.6 })),
  ];
}
