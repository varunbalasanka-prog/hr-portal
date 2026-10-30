import { loadCareers, siteUrl } from "@/lib/careers";
import { jobPath, loadJobs } from "@/lib/jobs";

export const revalidate = 300;

/** Plain-text list of open jobs for AI assistants (the llms.txt convention). */
export async function GET() {
  const base = siteUrl();
  const [loaded, jobs] = await Promise.all([loadCareers().catch(() => null), loadJobs().catch(() => null)]);
  const branches = loaded ?? [];
  const towns = [...new Set(branches.map((b) => b.town))];
  const lines = [
    "# Balasanka Group of Companies: jobs",
    "",
    "> Jewellery and automobile showrooms in South Tamil Nadu, India, hiring full-time staff. Apply online at the links below;",
    "> the form takes about 5 minutes and is in English and Tamil. Candidates must be 18 or older.",
    "",
    `- Careers page: ${base}/careers`,
    `- Apply (any branch): ${base}/apply`,
    `- Privacy notice: ${base}/privacy`,
    "",
    ...towns.flatMap((town) => [
      `## ${town}`,
      "",
      ...branches.filter((b) => b.town === town).map((b) =>
        `- [${b.name}](${base}/apply?branch=${b.id}) (${b.business_type}): ${b.posts.map((p) => {
          const j = jobs?.find((x) => x.branch.id === b.id && x.post === p);
          return j ? `[${p}](${base}${jobPath(j)})` : p;
        }).join(", ")}`),
      "",
    ]),
  ];
  if (!loaded) lines.push(`Openings could not be loaded just now; see ${base}/careers.`, "");
  else if (!branches.length) lines.push("No openings right now.", "");
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
