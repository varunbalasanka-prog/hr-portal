import { allPosts } from "@/lib/blog";
import { CAREERS_SITE, FOODS_PAGE, GROUP_SITE, brandsOf, townSlug } from "@/lib/group";
import { getSite } from "@/lib/site-data";

export const revalidate = 3600;

/** balasanka.in for AI assistants (the llms.txt convention): what the group is, its pages and every blog post. */
export async function GET() {
  const site = await getSite();
  const TOWNS = site.towns;
  const posts = await allPosts();
  const lines = [
    "# Balasanka Group of Companies",
    "",
    `> Family business founded in 1966 in Theni, Tamil Nadu, India. Runs two-wheeler dealerships, jewellery showrooms and watch and eyewear stores in ${TOWNS.join(", ")}, and makes dhal and tamarind (block, chappati and seedless) in Theni.`,
    "",
    "## Pages",
    "",
    `- [Home](${GROUP_SITE}/)`,
    ...site.groups.filter((g) => g.showrooms.length).map((g) => `- [${g.title}](${GROUP_SITE}/${g.slug}): ${brandsOf(g).join(", ")}`),
    `- [${site.foods.title}](${GROUP_SITE}/${FOODS_PAGE.slug}): ${site.foods.brands.map((b) => b.name).join(", ")}`,
    `- [All showrooms](${GROUP_SITE}/showrooms)`,
    ...TOWNS.map((t) => `- [Showrooms in ${t}](${GROUP_SITE}/showrooms/${townSlug(t)})`),
    `- [About](${GROUP_SITE}/about)`,
    `- [Contact](${GROUP_SITE}/contact)`,
    `- [Jobs](${CAREERS_SITE}/careers)`,
    "",
    "## Blog",
    "",
    ...posts.map((p) => `- [${p.title}](${GROUP_SITE}/blog/${p.slug}): ${p.description}`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
