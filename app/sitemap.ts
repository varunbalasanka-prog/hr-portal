import type { MetadataRoute } from "next";
import { loadCareers, siteUrl } from "@/lib/careers";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const branches = (await loadCareers().catch(() => null)) ?? [];
  return [
    { url: `${base}/careers`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/apply`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/llms.txt`, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...branches.map((b) => ({ url: `${base}/apply?branch=${b.id}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
