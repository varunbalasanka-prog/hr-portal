import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME } from "@/lib/careers";
import { findJob, istDate, jobContent, jobPath, jobPosting, loadJobs } from "@/lib/jobs";
import { formatDate } from "@/lib/dates";

export const revalidate = 300;

type Props = { params: Promise<{ town: string; slug: string }> };

async function load({ params }: Props) {
  const { town, slug } = await params;
  const jobs = await loadJobs();
  return jobs ? findJob(jobs, town, slug) : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const job = await load(props);
  if (!job) return { title: "Job closed · Balasanka Group", robots: { index: false } };
  const c = jobContent(job);
  const description = `${c.intro}${c.salary ? ` Salary ${c.salary}.` : ""} Apply online in 5 minutes.`;
  return {
    title: `${c.title} · Balasanka Group`,
    description,
    alternates: { canonical: jobPath(job) },
    openGraph: { title: c.title, description, images: ["/balasanka_logo.png"], locale: "en_IN", siteName: SITE_NAME },
  };
}

/** One open post at one store, with its own Google for Jobs listing. Closed or expired jobs are a 404 so Google drops them. */
export default async function JobPage(props: Props) {
  const job = await load(props);
  if (!job) notFound();
  const c = jobContent(job);
  const apply = `/apply?branch=${job.branch.id}&src=careers&post=${encodeURIComponent(job.post)}`;
  return (
    <main className="mx-auto max-w-2xl p-3 sm:p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPosting(job)).replace(/</g, "\\u003c") }} />
      <p className="mb-2 text-sm"><Link className="text-sky-800 underline" href="/careers">← All jobs / எல்லா வேலைகளும்</Link></p>
      <article className="card overflow-hidden">
        <header className="bg-brand px-4 py-5 text-white sm:px-6">
          <h1 className="text-xl font-bold">{job.post}</h1>
          <p className="text-sm text-slate-200">{job.branch.name} · {job.branch.town}</p>
        </header>
        <div className="space-y-4 p-4 text-sm leading-relaxed sm:p-6">
          <p>{c.intro}{c.summary && ` ${c.summary}`}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {c.salary && <><dt className="font-semibold">Salary</dt><dd>{c.salary}</dd></>}
            {c.shift && <><dt className="font-semibold">Working hours</dt><dd>{c.shift}</dd></>}
            <dt className="font-semibold">Address</dt><dd>{c.address}</dd>
            <dt className="font-semibold">Posted</dt><dd>{formatDate(istDate(job.opened_at))}</dd>
            {job.closes_on && <><dt className="font-semibold">Apply by</dt><dd>{formatDate(job.closes_on)}</dd></>}
          </dl>
          <List head="Duties" items={c.duties} />
          <List head="Requirements" items={c.requirements} />
          <List head="Benefits" items={c.benefits} />
          <p>Apply online in about 5 minutes.</p>
          <Link href={apply} className="btn-primary h-11 w-full text-base sm:w-auto">Apply for this job / விண்ணப்பிக்கவும்</Link>
        </div>
      </article>
    </main>
  );
}

function List({ head, items }: { head: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="font-bold text-brand">{head}</h2>
      <ul className="ml-5 list-disc">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}
