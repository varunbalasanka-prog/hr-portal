import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND_NOTES, GROUP_SITE, SHOWROOM_GROUPS, brandsOf } from "@/lib/group";
import { BusinessArt } from "../art";
import { BusinessLinks, CHAPTER, ShowroomRow, WRAP } from "../ui";

export const dynamicParams = false;
export const generateStaticParams = () => SHOWROOM_GROUPS.map((g) => ({ business: g.slug }));

const find = (slug: string) => SHOWROOM_GROUPS.find((g) => g.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ business: string }> }): Promise<Metadata> {
  const g = find((await params).business);
  if (!g) return {};
  const description = `${g.blurb} ${g.showrooms.length} Balasanka Group showrooms in South Tamil Nadu.`;
  return { title: `${g.title} | Balasanka Group`, description, alternates: { canonical: `${GROUP_SITE}/${g.slug}` } };
}

/** One business: its colour chapter as the opening, then each brand with every showroom's address. */
export default async function BusinessPage({ params }: { params: Promise<{ business: string }> }) {
  const g = find((await params).business);
  if (!g) notFound();
  const c = CHAPTER[g.key];
  const towns = [...new Set(g.showrooms.map((s) => s.town))];
  return (
    <>
      <section className={`${c.field} ${WRAP} py-14 sm:py-20`}>
        <div className="grid items-center gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{g.title}</h1>
            <p lang="ta" className="mt-2 text-xl text-[#4a4666]">{g.tamil}</p>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-[#4a4666]">
              {g.blurb} {g.showrooms.length} showrooms in {towns.join(", ").replace(/, ([^,]*)$/, " and $1")}.
            </p>
          </div>
          <div className="flex justify-center md:col-span-5">
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
                <p className="mt-3 max-w-[34ch] text-lg leading-relaxed text-[#4a4666]">{BRAND_NOTES[b]}</p>
              </div>
              <ul className={`md:col-span-7 ${rooms.length > 2 ? "grid gap-x-10 sm:grid-cols-2" : ""}`}>
                {rooms.map((s) => <ShowroomRow key={s.street} s={s} showTown />)}
              </ul>
            </section>
          );
        })}
      </div>

      <BusinessLinks except={g.key} />
    </>
  );
}
