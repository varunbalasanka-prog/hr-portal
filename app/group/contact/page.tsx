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
      <a className={`text-2xl font-semibold sm:text-3xl ${LINK}`} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#4a4666]">For questions about the group, our companies or working with us as a brand partner.</p>
    </>],
    ["Visit a showroom", <>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xl font-semibold">
        {TOWNS.map((t) => <li key={t}><a className="hover:underline" href={groupHref(`/showrooms/${townSlug(t)}`)}>{t}</a></li>)}
      </ul>
      <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#4a4666]">For a purchase, an order or a service booking, the showroom near you can help directly.</p>
    </>],
    ["Find a job", <>
      <a className="inline-flex h-12 items-center rounded-md bg-[#d9261c] px-7 text-lg font-semibold text-white hover:bg-[#b81f17]" href={`${CAREERS_SITE}/careers`}>See open jobs</a>
      <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#4a4666]">Every open job at our showrooms, with an online application that takes about five minutes.</p>
    </>],
  ];
  return (
    <>
      <section className={`${WRAP} pb-8 pt-14 sm:pt-20`}>
        <h1 data-reveal className="text-4xl font-bold leading-tight sm:text-5xl text-[#2b2177]">Contact</h1>
      </section>
      <div className="pb-14 sm:pb-20">
        {rows.map(([title, body], i) => (
          <section key={title} aria-labelledby={`c-${i}`} className={`${WRAP} grid gap-4 py-10 md:grid-cols-12 ${i === 1 ? "bg-[#f3f2f9]" : ""}`}>
            <h2 data-reveal id={`c-${i}`} className="text-2xl font-bold sm:text-3xl md:col-span-4">{title}</h2>
            <div className="md:col-span-8">{body}</div>
          </section>
        ))}
      </div>
    </>
  );
}
