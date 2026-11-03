import type { Metadata } from "next";
import { groupHref, pageMeta, townSlug } from "@/lib/group";
import { getSite } from "@/lib/site-data";
import { LINK, NEUTRAL, WRAP } from "../ui";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return pageMeta(
    "Showrooms | Balasanka Group",
    `Addresses and directions for all ${site.all.length} Balasanka Group showrooms in ${site.towns.length} towns of South Tamil Nadu: ${site.towns.join(", ")}.`,
    "/showrooms",
  );
}

/** Every town, each as a row: the town on the left, its showrooms by name on the right. */
export default async function ShowroomsPage() {
  const site = await getSite();
  const ALL_SHOWROOMS = site.all, TOWNS = site.towns;
  const kindOf = (s: (typeof ALL_SHOWROOMS)[number]) => site.groups.find((g) => g.key === s.business)!.title.toLowerCase();
  return (
    <>
      <section className={`${WRAP} pb-8 pt-10 sm:pt-14`}>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl text-[#2b2177]">Showrooms</h1>
        <p className="mt-4 max-w-[44ch] text-lg leading-relaxed text-[#4a4666]">
          {ALL_SHOWROOMS.length} showrooms in {TOWNS.length} towns. Choose a town for addresses and directions.
        </p>
      </section>
      <div className="pb-14 sm:pb-20">
        {TOWNS.map((t, i) => {
          const rooms = ALL_SHOWROOMS.filter((s) => s.town === t).sort((a, b) => a.brand.localeCompare(b.brand));
          return (
            <section key={t} aria-labelledby={`t-${i}`} className={`${WRAP} grid gap-4 py-8 md:grid-cols-12 [contain-intrinsic-size:auto_160px] [content-visibility:auto] ${i % 2 ? "" : NEUTRAL}`}>
              <h2 data-reveal id={`t-${i}`} className="text-2xl font-semibold sm:text-3xl md:col-span-4">
                <a href={groupHref(`/showrooms/${townSlug(t)}`)} className="hover:underline">{t}</a>
              </h2>
              <div className="md:col-span-8">
                <p className="text-lg leading-relaxed">
                  {rooms.map((s, j) => (
                    <span key={s.street + s.brand}>{j ? ", " : ""}<span className="font-semibold">{s.brand}</span> <span className="text-[#4a4666]">({kindOf(s)})</span></span>
                  ))}
                </p>
                <a href={groupHref(`/showrooms/${townSlug(t)}`)} className={`mt-3 inline-block text-lg font-normal ${LINK}`}>Addresses in {t}</a>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
