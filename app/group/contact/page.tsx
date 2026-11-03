import type { Metadata } from "next";
import { CAREERS_SITE, groupHref, pageMeta, townSlug } from "@/lib/group";
import { getSite } from "@/lib/site-data";
import { EmailLink } from "../email-link";
import { WRAP } from "../ui";

export const metadata: Metadata = pageMeta("Contact | Balasanka Group", "How to reach the Balasanka Group: email, showroom addresses and jobs.", "/contact");

/** Three ways to reach us, each as a row: what it is for on the left, how on the right. */
export default async function ContactPage() {
  const site = await getSite();
  const c = site.contact;
  const rows: [string, React.ReactNode][] = [
    ["Write to us", <>
      <EmailLink email={c.email} className="text-2xl font-semibold sm:text-3xl" />
      <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#4a4666]">{c.write}</p>
    </>],
    ["Visit a showroom", <>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xl font-semibold">
        {site.towns.map((t) => <li key={t}><a className="inline-block py-1.5 hover:underline" href={groupHref(`/showrooms/${townSlug(t)}`)}>{t}</a></li>)}
      </ul>
      <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#4a4666]">{c.visit}</p>
    </>],
    ["Find a job", <>
      <a className="inline-flex h-12 items-center rounded-md bg-[#d9261c] px-7 text-lg font-semibold text-white hover:bg-[#b81f17]" href={`${CAREERS_SITE}/careers`}>See open jobs</a>
      <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#4a4666]">{c.jobs}</p>
    </>],
  ];
  return (
    <>
      <section className={`${WRAP} pb-8 pt-10 sm:pt-14`}>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl text-[#2b2177]">Contact</h1>
      </section>
      <div className="pb-14 sm:pb-20">
        {rows.map(([title, body], i) => (
          <section key={title} aria-labelledby={`c-${i}`} className={`${WRAP} grid gap-4 py-10 md:grid-cols-12 ${i === 1 ? "bg-[#f4f4f6]" : ""}`}>
            <h2 data-reveal id={`c-${i}`} className="text-2xl font-semibold sm:text-3xl md:col-span-4">{title}</h2>
            <div className="md:col-span-8">{body}</div>
          </section>
        ))}
      </div>
    </>
  );
}
