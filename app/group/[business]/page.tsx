import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allPosts } from "@/lib/blog";
import { brandsOf, groupHref, ldJson, pageMeta, pageSchema } from "@/lib/group";
import { BUSINESS_SLUGS } from "@/lib/site";
import { getSite } from "@/lib/site-data";
import { BusinessArt } from "../art";
import { PostList } from "../blog/post-parts";
import { BusinessLinks, CHAPTER, LINK, ShowroomRow, WRAP } from "../ui";

export const dynamicParams = false;
export const generateStaticParams = () => Object.values(BUSINESS_SLUGS).map((business) => ({ business }));

const find = async (slug: string) => (await getSite()).groups.find((g) => g.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ business: string }> }): Promise<Metadata> {
  const g = await find((await params).business);
  if (!g) return {};
  const description = `${g.blurb} ${g.showrooms.length} Balasanka Group showrooms in South Tamil Nadu.`;
  return pageMeta(`${g.title} | Balasanka Group`, description, `/${g.slug}`);
}

/** One business: its colour chapter as the opening, then each brand with every showroom's address. */
export default async function BusinessPage({ params }: { params: Promise<{ business: string }> }) {
  const site = await getSite();
  const { business } = await params;
  const g = site.groups.find((x) => x.slug === business);
  if (!g) notFound();
  const c = CHAPTER[g.key];
  const towns = [...new Set(g.showrooms.map((s) => s.town))];
  const posts = (await allPosts()).filter((p) => p.category === g.key).slice(0, 3);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(pageSchema(g.showrooms, [[g.title, `/${g.slug}`]])) }} />
      <section className={`${c.field} ${WRAP} py-10 sm:py-16`}>
        <div className="grid items-center gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{g.title}</h1>
            <p lang="ta" className="mt-2 text-xl text-[#4a4666]">{g.tamil}</p>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-[#4a4666]">
              {g.blurb} {g.showrooms.length ? `${g.showrooms.length} ${g.showrooms.length === 1 ? "showroom" : "showrooms"} in ${towns.join(", ").replace(/, ([^,]*)$/, " and $1")}.` : ""}
            </p>
          </div>
          <div className="flex md:col-span-5 md:justify-center">
            <BusinessArt k={g.key} />
          </div>
        </div>
      </section>

      <div className={`${WRAP} pt-14 sm:pt-20`}>
        {brandsOf(g).map((b, i) => {
          const rooms = g.showrooms.filter((s) => s.brand === b).sort((x, y) => x.town.localeCompare(y.town));
          return (
            <section key={b} aria-labelledby={`b-${i}`} className={`grid gap-6 md:grid-cols-12 ${i ? "mt-14 sm:mt-16" : ""}`}>
              <div data-reveal className="md:col-span-5">
                <h2 id={`b-${i}`} className="text-3xl font-semibold sm:text-4xl">{b}</h2>
                <p className="mt-3 max-w-[34ch] text-lg leading-relaxed text-[#4a4666]">{site.brand_notes[b]}</p>
              </div>
              <ul className={`md:col-span-7 ${rooms.length > 2 ? "grid gap-x-10 sm:grid-cols-2" : ""}`}>
                {rooms.map((s) => <ShowroomRow key={s.street} s={s} showTown />)}
              </ul>
            </section>
          );
        })}
      </div>

      {posts.length > 0 && (
        <section aria-labelledby="h-guides" className={`${WRAP} pt-14 sm:pt-20`}>
          <h2 data-reveal id="h-guides" className="text-2xl font-semibold sm:text-3xl">Guides from our blog</h2>
          <PostList posts={posts} href={(s) => groupHref(`/blog/${s}`)} headingLevel={3} />
          <a href={groupHref("/blog")} className={`inline-block py-2 text-lg ${LINK}`}>All posts</a>
        </section>
      )}

      <BusinessLinks site={site} except={g.key} />
    </>
  );
}
