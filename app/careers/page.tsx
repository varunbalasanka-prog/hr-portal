import type { Metadata } from "next";
import Link from "next/link";
import { loadCareerListing, SITE_NAME, siteSchema } from "@/lib/careers";
import { jobPath, loadJobs } from "@/lib/jobs";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Careers · Balasanka Group of Companies",
  description: "Open jobs at Balasanka Group showrooms across South Tamil Nadu. Apply online in 5 minutes. / வேலைவாய்ப்புகள்.",
  openGraph: { title: "Careers at Balasanka Group · வேலைவாய்ப்புகள்", description: "Open jobs at our showrooms. Apply online in 5 minutes.", images: ["/balasanka_logo.png"], locale: "en_IN", siteName: SITE_NAME },
  alternates: { canonical: "/careers" },
};

export default async function CareersPage() {
  const [listing, jobs] = await Promise.all([loadCareerListing(), loadJobs()]);
  const branches = listing?.branches ?? null;
  // Each open post links to its own job page, which carries the Google for Jobs listing (none on this page).
  const pathOf = (branchId: string, post: string) => { const j = jobs?.find((x) => x.branch.id === branchId && x.post === post); return j ? jobPath(j) : null; };
  const towns = [...new Set((branches ?? []).map((b) => b.town))];
  return (
    <main className="mx-auto max-w-4xl p-3 sm:p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema()).replace(/</g, "\\u003c") }} />
      <header className="mb-4 rounded-lg bg-brand px-4 py-6 text-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/balasanka_logo.png" alt="" className="mx-auto mb-2 h-14 w-auto rounded bg-white p-1" />
        <h1 className="font-serif text-xl font-extrabold uppercase tracking-wide">Work with Balasanka Group</h1>
        <p className="text-sm text-slate-200">பாலசங்கா குழுமத்தில் பணியாற்றுங்கள்</p>
        <p className="mt-2 text-sm text-slate-200">Jewellery and automobile showrooms in {towns.join(", ") || "South Tamil Nadu"}.</p>
        {/* No general "Apply now" here: applicants pick a showroom below, so the form opens locked to it. */}
        <p className="mt-3 text-sm font-semibold">Choose a showroom below to apply. / விண்ணப்பிக்க கீழே ஒரு கிளையைத் தேர்ந்தெடுக்கவும்.</p>
      </header>
      {!branches && <p className="card p-6 text-center text-sm text-red-700">Could not load openings. Please refresh.</p>}
      {branches && branches.length === 0 && <p className="card p-6 text-center text-sm">No openings right now. Please check again later. / தற்போது காலியிடங்கள் இல்லை.</p>}
      {towns.map((town) => (
        <section key={town} className="mb-5">
          <h2 className="mb-2 text-lg font-bold">{town}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {branches!.filter((b) => b.town === town).map((b) => (
              <article key={b.id} className="card flex flex-col p-4">
                <h3 className="font-bold">{b.name}</h3>
                <p className="mb-2 text-xs text-slate-500">{b.business_type}</p>
                <ul className="mb-3 flex flex-wrap gap-1.5 text-xs">
                  {b.posts.map((p) => {
                    const href = pathOf(b.id, p);
                    return <li key={p}>{href
                      ? <Link href={href} className="block rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-900 hover:bg-sky-100">{p}</Link>
                      : <span className="block rounded border border-slate-200 bg-slate-50 px-2 py-0.5">{p}</span>}</li>;
                  })}
                </ul>
                <Link href={`/apply?branch=${b.id}&src=careers`} className="btn-primary mt-auto self-start">Apply at this branch</Link>
              </article>
            ))}
          </div>
        </section>
      ))}
      <footer className="mt-8 text-center text-xs text-slate-500"><Link className="underline" href="/privacy">Privacy notice / தனியுரிமை அறிவிப்பு</Link>
        {" · "}<Link className="underline" href="/login">Staff login</Link></footer>
    </main>
  );
}
