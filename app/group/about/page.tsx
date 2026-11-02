import type { Metadata } from "next";
import { ALL_SHOWROOMS, COMPANIES, GROUP_SITE, SHOWROOM_GROUPS, TOWNS } from "@/lib/group";
import { BusinessLinks, WRAP } from "../ui";

export const metadata: Metadata = {
  title: "About | Balasanka Group",
  description: `The companies of the Balasanka Group and the showrooms each one runs in South Tamil Nadu.`,
  alternates: { canonical: `${GROUP_SITE}/about` },
};

const list = (xs: string[]) => xs.join(", ").replace(/, ([^,]*)$/, " and $1");

/** Who we are: the group in one paragraph, then each company with what it runs, straight from the showroom list. */
export default function AboutPage() {
  return (
    <>
      <section className={`${WRAP} py-14 sm:py-20`}>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl text-[#2b2177]">About the group</h1>
        <div className="mt-10 grid gap-8 md:grid-cols-12">
          <p lang="ta" className="text-2xl font-semibold text-[#d9261c] md:col-span-5">பாலசங்கா குழுமம்</p>
          <div className="space-y-4 text-lg leading-relaxed text-[#4a4666] md:col-span-7">
            <p className="max-w-[46ch]">
              Balasanka Group is a family of {COMPANIES.length} companies running {ALL_SHOWROOMS.length} showrooms across {list(TOWNS)}.
            </p>
            <p className="max-w-[46ch]">
              We run our own jewellery house, Akshaya Velli, alongside franchise showrooms and dealerships for Tanishq, Mia by Tanishq,
              CaratLane, Titan, Titan Eye+, Fastrack, TVS and Honda.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="h-companies" className={`${WRAP} bg-[#f3f2f9] py-14 sm:py-20`}>
        <h2 id="h-companies" className="text-3xl font-bold sm:text-4xl">Our companies</h2>
        <ul className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {COMPANIES.map((c) => {
            const rooms = ALL_SHOWROOMS.filter((s) => s.company === c);
            const kinds = SHOWROOM_GROUPS.filter((g) => g.showrooms.some((s) => s.company === c)).map((g) => g.title.toLowerCase());
            return (
              <li key={c}>
                <h3 className="text-xl font-semibold">{c}</h3>
                <p className="mt-2 max-w-[48ch] text-lg leading-relaxed text-[#4a4666]">
                  Runs {rooms.length} {rooms.length === 1 ? "showroom" : "showrooms"} ({list(kinds)}): {list([...new Set(rooms.map((s) => `${s.brand} in ${s.town}`))])}.
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <BusinessLinks />
    </>
  );
}
