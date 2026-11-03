import { allPosts } from "@/lib/blog";
import { CAREERS_SITE, GROUP_SITE, SHOWROOM_GROUPS, TOWNS, brandsOf, townSlug } from "@/lib/group";

export const dynamic = "force-static";

/** balasanka.in for AI assistants (the llms.txt convention): what the group is, its pages and every blog post. */
export function GET() {
  const lines = [
    "# Balasanka Group of Companies",
    "",
    `> Family business founded in 1966 in Theni, Tamil Nadu, India. Runs two-wheeler dealerships, jewellery showrooms and watch and eyewear stores in ${TOWNS.join(", ")}.`,
    "",
    "## Pages",
    "",
    `- [Home](${GROUP_SITE}/)`,
    ...SHOWROOM_GROUPS.map((g) => `- [${g.title}](${GROUP_SITE}/${g.slug}): ${brandsOf(g).join(", ")}`),
    `- [All showrooms](${GROUP_SITE}/showrooms)`,
    ...TOWNS.map((t) => `- [Showrooms in ${t}](${GROUP_SITE}/showrooms/${townSlug(t)})`),
    `- [About](${GROUP_SITE}/about)`,
    `- [Contact](${GROUP_SITE}/contact)`,
    `- [Jobs](${CAREERS_SITE}/careers)`,
    "",
    "## Blog",
    "",
    ...allPosts().map((p) => `- [${p.title}](${GROUP_SITE}/blog/${p.slug}): ${p.description}`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
