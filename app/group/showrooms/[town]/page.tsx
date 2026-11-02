import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GROUP_SITE, SHOWROOM_GROUPS, TOWNS, groupHref, townSlug } from "@/lib/group";
import { CHAPTER, ShowroomRow, WRAP } from "../../ui";

export const dynamicParams = false;
export const generateStaticParams = () => TOWNS.map((t) => ({ town: townSlug(t) }));

const find = (slug: string) => TOWNS.find((t) => townSlug(t) === slug);

export async function generateMetadata({ params }: { params: Promise<{ town: string }> }): Promise<Metadata> {
  const town = find((await params).town);
  if (!town) return {};
  return {
    title: `Showrooms in ${town} | Balasanka Group`,
    description: `Addresses and directions for Balasanka Group's jewellery, watch and two-wheeler showrooms in ${town}, Tamil Nadu.`,
    alternates: { canonical: `${GROUP_SITE}/showrooms/${townSlug(town)}` },
  };
}

/** One town: its showrooms grouped by business, each business on its own colour. */
export default async function TownPage({ params }: { params: Promise<{ town: string }> }) {
  const town = find((await params).town);
  if (!town) notFound();
  const groups = SHOWROOM_GROUPS.map((g) => ({ g, rooms: g.showrooms.filter((s) => s.town === town) })).filter((x) => x.rooms.length);
  const total = groups.reduce((n, x) => n + x.rooms.length, 0);
  return (
    <>
      <section className={`${WRAP} pb-8 pt-14 sm:pt-20`}>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl text-[#2b2177]">{town}</h1>
        <p className="mt-4 max-w-[44ch] text-lg leading-relaxed text-[#4a4666]">{total} Balasanka {total === 1 ? "showroom" : "showrooms"} in {town}, Tamil Nadu.</p>
      </section>

      {groups.map(({ g, rooms }) => {
        const c = CHAPTER[g.key];
        return (
          <section key={g.key} aria-labelledby={`k-${g.key}`} className={`${c.field} ${c.ink} ${WRAP} grid gap-6 py-14 md:grid-cols-12 lg:py-20`}>
            <h2 id={`k-${g.key}`} className="text-2xl font-bold sm:text-3xl md:col-span-4">
              <a href={groupHref(`/${g.slug}`)} className="hover:underline">{g.title}</a>
            </h2>
            <ul className="grid gap-x-10 sm:grid-cols-2 md:col-span-8">
              {rooms.map((s) => <ShowroomRow key={s.brand + s.street} s={s} />)}
            </ul>
          </section>
        );
      })}

      <nav aria-labelledby="other-towns" className={`${WRAP} py-14 sm:py-16`}>
        <h2 id="other-towns" className="text-2xl font-bold sm:text-3xl">Other towns</h2>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xl font-semibold">
          {TOWNS.filter((t) => t !== town).map((t) => <li key={t}><a href={groupHref(`/showrooms/${townSlug(t)}`)} className="hover:underline">{t}</a></li>)}
        </ul>
      </nav>
    </>
  );
}
