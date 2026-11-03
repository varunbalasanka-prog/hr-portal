import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { groupHref, ldJson, pageMeta, pageSchema, townSlug } from "@/lib/group";
import { getSite } from "@/lib/site-data";
import { CHAPTER, ShowroomRow, WRAP } from "../../ui";

// A town added on the Website page gets its page on first visit.
export const generateStaticParams = async () => (await getSite()).towns.map((t) => ({ town: townSlug(t) }));

const find = async (slug: string) => (await getSite()).towns.find((t) => townSlug(t) === slug);

export async function generateMetadata({ params }: { params: Promise<{ town: string }> }): Promise<Metadata> {
  const town = await find((await params).town);
  if (!town) return {};
  const brands = [...new Set((await getSite()).all.filter((s) => s.town === town).map((s) => s.brand))];
  return pageMeta(
    `Showrooms in ${town} | Balasanka Group`,
    `Addresses and directions for Balasanka Group showrooms in ${town}, Tamil Nadu: ${brands.join(", ")}.`,
    `/showrooms/${townSlug(town)}`,
  );
}

/** One town: its showrooms grouped by business, each business on its own colour. */
export default async function TownPage({ params }: { params: Promise<{ town: string }> }) {
  const site = await getSite();
  const town = await find((await params).town);
  if (!town) notFound();
  const groups = site.groups.map((g) => ({ g, rooms: g.showrooms.filter((s) => s.town === town) })).filter((x) => x.rooms.length);
  const total = groups.reduce((n, x) => n + x.rooms.length, 0);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(pageSchema(groups.flatMap((x) => x.rooms), [["Showrooms", "/showrooms"], [town, `/showrooms/${townSlug(town)}`]])) }}
      />
      <section className={`${WRAP} pb-8 pt-10 sm:pt-14`}>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl text-[#2b2177]">{town}</h1>
        <p className="mt-4 max-w-[44ch] text-lg leading-relaxed text-[#4a4666]">{total} Balasanka {total === 1 ? "showroom" : "showrooms"} in {town}, Tamil Nadu.</p>
      </section>

      {groups.map(({ g, rooms }) => {
        const c = CHAPTER[g.key];
        return (
          <section key={g.key} aria-labelledby={`k-${g.key}`} className={`${c.field} ${c.ink} ${WRAP} grid gap-6 py-14 md:grid-cols-12 lg:py-20`}>
            <h2 data-reveal id={`k-${g.key}`} className="text-2xl font-semibold sm:text-3xl md:col-span-4">
              <a href={groupHref(`/${g.slug}`)} className="hover:underline">{g.title}</a>
            </h2>
            <ul className="grid gap-x-10 sm:grid-cols-2 md:col-span-8">
              {rooms.map((s) => <ShowroomRow key={s.brand + s.street} s={s} />)}
            </ul>
          </section>
        );
      })}

      <nav aria-labelledby="other-towns" className={`${WRAP} py-14 sm:py-16`}>
        <h2 data-reveal id="other-towns" className="text-2xl font-semibold sm:text-3xl">Other towns</h2>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xl font-semibold">
          {site.towns.filter((t) => t !== town).map((t) => <li key={t}><a href={groupHref(`/showrooms/${townSlug(t)}`)} className="inline-block py-1.5 hover:underline">{t}</a></li>)}
        </ul>
      </nav>
    </>
  );
}
