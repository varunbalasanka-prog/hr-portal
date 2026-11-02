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
      <section className={`${c.field} ${c.ink} ${WRAP} pb-16 pt-16 sm:pt-24 lg:pb-24`}>
        <div className="grid items-center gap-10 md:grid-cols-12">
          <h1 className="max-w-[12ch] text-[clamp(3.2rem,8vw,8rem)] font-bold leading-[0.95] tracking-[-0.035em] md:col-span-7">{g.title}</h1>
          <BusinessArt k={g.key} className={`md:col-span-5 ${g.key === "jewellery" ? "mx-auto w-44 md:w-56" : "w-full max-w-[30rem] md:justify-self-end"}`} />
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-12">
          <p lang="ta" className={`text-2xl font-semibold md:col-span-5 ${c.soft}`}>{g.tamil}</p>
          <p className="max-w-[44ch] text-xl leading-relaxed md:col-span-7">
            {g.blurb} {g.showrooms.length} showrooms in {towns.join(", ").replace(/, ([^,]*)$/, " and $1")}.
          </p>
        </div>
      </section>

      <div className={`${WRAP} py-16 lg:py-24`}>
        {brandsOf(g).map((b, i) => {
          const rooms = g.showrooms.filter((s) => s.brand === b).sort((x, y) => x.town.localeCompare(y.town));
          return (
            <section key={b} aria-labelledby={`b-${i}`} className={`grid gap-6 md:grid-cols-12 ${i ? "mt-20 lg:mt-28" : ""}`}>
              <div className="md:col-span-5">
                <h2 id={`b-${i}`} className="text-4xl font-bold tracking-tight sm:text-5xl">{b}</h2>
                <p className="mt-3 max-w-[34ch] text-lg leading-relaxed text-[#3e3a5c]">{BRAND_NOTES[b]}</p>
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
