import type { MetadataRoute } from "next";
import { loadCareers, siteUrl } from "@/lib/careers";
import { jobLastModified, jobPath, loadJobs } from "@/lib/jobs";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [branches, jobs] = await Promise.all([loadCareers().catch(() => null), loadJobs().catch(() => null)]);
  return [
    { url: `${base}/careers`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/apply`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/llms.txt`, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    // One page per open job; lastmod moves when its closing date, salary or role text changes.
    ...(jobs ?? []).map((j) => ({ url: `${base}${jobPath(j)}`, lastModified: jobLastModified(j), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...(branches ?? []).map((b) => ({ url: `${base}/apply?branch=${b.id}`, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
