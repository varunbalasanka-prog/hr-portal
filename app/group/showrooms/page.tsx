import type { Metadata } from "next";
import { ALL_SHOWROOMS, GROUP_SITE, SHOWROOM_GROUPS, TOWNS, groupHref, townSlug } from "@/lib/group";
import { LINK, WRAP } from "../ui";

export const metadata: Metadata = {
  title: "Showrooms | Balasanka Group",
  description: `Addresses and directions for all ${ALL_SHOWROOMS.length} Balasanka Group showrooms in ${TOWNS.length} towns of South Tamil Nadu.`,
  alternates: { canonical: `${GROUP_SITE}/showrooms` },
};

const kindOf = (brand: string) => SHOWROOM_GROUPS.find((g) => g.showrooms.some((s) => s.brand === brand))!.title.toLowerCase();

/** Every town, each as a row: the town on the left, its showrooms by name on the right. */
export default function ShowroomsPage() {
  return (
    <>
      <section className={`${WRAP} pb-12 pt-16 sm:pt-24`}>
        <h1 className="text-[clamp(3.2rem,9vw,8.5rem)] font-bold leading-[0.95] tracking-[-0.035em] text-[#2b2177]">Showrooms</h1>
        <p className="mt-8 max-w-[44ch] text-xl leading-relaxed">
          {ALL_SHOWROOMS.length} showrooms in {TOWNS.length} towns. Choose a town for addresses and directions.
        </p>
      </section>
      <div className={`${WRAP} pb-20 lg:pb-28`}>
        {TOWNS.map((t, i) => {
          const rooms = ALL_SHOWROOMS.filter((s) => s.town === t).sort((a, b) => a.brand.localeCompare(b.brand));
          return (
            <section key={t} aria-labelledby={`t-${i}`} className={`grid gap-4 py-8 md:grid-cols-12 ${i % 2 ? "" : "bg-[#f3f2f7] -mx-[clamp(1rem,3vw,2.5rem)] px-[clamp(1rem,3vw,2.5rem)]"}`}>
              <h2 id={`t-${i}`} className="text-4xl font-bold tracking-tight md:col-span-4">
                <a href={groupHref(`/showrooms/${townSlug(t)}`)} className="hover:underline">{t}</a>
              </h2>
              <div className="md:col-span-8">
                <p className="text-xl leading-relaxed">
                  {rooms.map((s, j) => (
                    <span key={s.street + s.brand}>{j ? ", " : ""}<span className="font-semibold">{s.brand}</span> <span className="text-[#3e3a5c]">({kindOf(s.brand)})</span></span>
                  ))}
                </p>
                <a href={groupHref(`/showrooms/${townSlug(t)}`)} className={`mt-3 inline-block text-lg font-medium ${LINK}`}>Addresses in {t}</a>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
