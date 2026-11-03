import type { MetadataRoute } from "next";
import { allPosts } from "@/lib/blog";
import { FOODS_PAGE, GROUP_SITE, townSlug } from "@/lib/group";
import { getSite } from "@/lib/site-data";

export const revalidate = 3600;

/** balasanka.in's own sitemap (served at balasanka.in/sitemap.xml by the middleware). Job pages stay in hr.balasanka.in's sitemap. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, posts] = await Promise.all([getSite(), allPosts()]);
  const page = (path: string, priority: number) => ({ url: `${GROUP_SITE}${path}`, changeFrequency: "monthly" as const, priority });
  return [
    page("/", 1),
    ...site.groups.filter((g) => g.showrooms.length).map((g) => page(`/${g.slug}`, 0.9)),
    page(`/${FOODS_PAGE.slug}`, 0.9),
    page("/showrooms", 0.9),
    ...site.towns.map((t) => page(`/showrooms/${townSlug(t)}`, 0.8)),
    page("/about", 0.7),
    page("/contact", 0.6),
    page("/blog", 0.7),
    ...posts.map((p) => ({ url: `${GROUP_SITE}/blog/${p.slug}`, lastModified: p.updated ?? p.date, changeFrequency: "yearly" as const, priority: 0.6 })),
  ];
}
