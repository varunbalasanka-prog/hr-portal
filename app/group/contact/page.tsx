import type { Metadata } from "next";
import { CAREERS_SITE, CONTACT_EMAIL, GROUP_SITE, TOWNS, groupHref, townSlug } from "@/lib/group";
import { LINK, WRAP } from "../ui";

export const metadata: Metadata = {
  title: "Contact | Balasanka Group",
  description: "How to reach the Balasanka Group: email, showroom addresses and jobs.",
  alternates: { canonical: `${GROUP_SITE}/contact` },
};

/** Three ways to reach us, each as a row: what it is for on the left, how on the right. */
export default function ContactPage() {
  const rows: [string, React.ReactNode][] = [
    ["Write to us", <>
      <a className={`text-3xl font-semibold sm:text-4xl ${LINK}`} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#3e3a5c]">For questions about the group, our companies or working with us as a brand partner.</p>
    </>],
    ["Visit a showroom", <>
      <ul className="flex flex-wrap gap-x-7 gap-y-2 text-2xl font-semibold">
        {TOWNS.map((t) => <li key={t}><a className="hover:underline" href={groupHref(`/showrooms/${townSlug(t)}`)}>{t}</a></li>)}
      </ul>
      <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#3e3a5c]">For a purchase, an order or a service booking, the showroom near you can help directly.</p>
    </>],
    ["Find a job", <>
      <a className="inline-flex h-13 items-center rounded-md bg-[#d9261c] px-7 text-lg font-semibold text-white hover:bg-[#b81f17]" href={`${CAREERS_SITE}/careers`}>See open jobs</a>
      <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#3e3a5c]">Every open job at our showrooms, with an online application that takes about five minutes.</p>
    </>],
  ];
  return (
    <>
      <section className={`${WRAP} pb-12 pt-16 sm:pt-24`}>
        <h1 className="text-[clamp(3.2rem,9vw,8.5rem)] font-bold leading-[0.95] tracking-[-0.035em] text-[#2b2177]">Contact</h1>
      </section>
      <div className={`${WRAP} pb-20 lg:pb-28`}>
        {rows.map(([title, body], i) => (
          <section key={title} aria-labelledby={`c-${i}`} className={`grid gap-4 py-10 md:grid-cols-12 ${i === 1 ? "bg-[#f3f2f7] -mx-[clamp(1rem,3vw,2.5rem)] px-[clamp(1rem,3vw,2.5rem)]" : ""}`}>
            <h2 id={`c-${i}`} className="text-3xl font-bold tracking-tight md:col-span-4">{title}</h2>
            <div className="md:col-span-8">{body}</div>
          </section>
        ))}
      </div>
    </>
  );
}
