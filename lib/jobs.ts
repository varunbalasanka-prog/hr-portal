import "server-only";
import { cache } from "react";
import { createPublicClient } from "./supabase/public";
import { siteUrl } from "./careers";

/** One open post at one store, as public_jobs() returns it (migration 0024). */
export type Job = {
  id: string;
  post: string;
  opened_at: string;
  closes_on: string | null;
  updated_at: string;
  salary_min: number | null;
  salary_max: number | null;
  branch: {
    id: string; name: string; town: string; division: string | null; business_type: string;
    street_address: string | null; postal_code: string | null;
  };
  role: { summary: string; duties: string; requirements: string; shift: string; benefits: string; updated_at: string } | null;
};

const REGION = "Tamil Nadu";
const ORG = "Balasanka Group of Companies";

/** Open jobs whose closing date hasn't passed. null when the database can't be reached (or 0024 hasn't run). */
export const loadJobs = cache(async (): Promise<Job[] | null> => {
  const { data, error } = await createPublicClient().rpc("public_jobs");
  if (error || !Array.isArray(data)) return null;
  return data as Job[];
});

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** The store's brand, e.g. "Akshaya Velli" for "Akshaya Velli - Theni". */
export const brandOf = (b: Job["branch"]) => b.division?.trim() || b.name.split(" - ")[0];

/** /jobs/theni/akshaya-velli-executive-sales */
export const jobPath = (j: Pick<Job, "post" | "branch">) => `/jobs/${slugify(j.branch.town)}/${slugify(`${brandOf(j.branch)} ${j.post}`)}`;

export function findJob(jobs: Job[], town: string, slug: string) {
  return jobs.find((j) => jobPath(j) === `/jobs/${town}/${slug}`) ?? null;
}

/** "a" or "an" by sound: an automobile, a jewellery, an office, a cycle. */
export const article = (word: string) => (/^[aeio]/i.test(word) || /^u(?!ni|se|su|ro)/i.test(word) ? "an" : "a");

const KIND: Record<string, string> = { Jewellery: "jewellery showroom", Automobiles: "automobile showroom", Cycles: "cycle showroom", Office: "office" };
export const placeKind = (businessType: string) => KIND[businessType] ?? `${businessType.toLowerCase()} showroom`;

const lines = (s: string | undefined) => (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

/** Everything a job page shows, in one place so the page and its JSON-LD always say the same thing. */
export function jobContent(j: Job) {
  const brand = brandOf(j.branch);
  const kind = placeKind(j.branch.business_type);
  const intro = `${j.post} at ${brand}, ${article(kind)} ${kind} of ${ORG} in ${j.branch.town}, ${REGION}. Full-time job.`;
  return {
    title: `${j.post} – ${brand}, ${j.branch.town}`,
    intro,
    summary: j.role?.summary?.trim() || "",
    duties: lines(j.role?.duties),
    requirements: lines(j.role?.requirements),
    shift: j.role?.shift?.trim() || "",
    benefits: lines(j.role?.benefits),
    salary: salaryText(j),
    address: [j.branch.street_address, j.branch.town, `${REGION} ${j.branch.postal_code ?? ""}`.trim()].filter(Boolean).join(", "),
  };
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export function salaryText(j: Pick<Job, "salary_min" | "salary_max">) {
  const { salary_min: lo, salary_max: hi } = j;
  if (lo && hi && hi !== lo) return `${inr(lo)} – ${inr(hi)} per month`;
  if (lo || hi) return `${inr((lo || hi)!)} per month`;
  return "";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const list = (head: string, items: string[]) => (items.length ? `<p><strong>${head}</strong></p><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");

/** India time: the posting day and the end of the closing day. */
export const istDate = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** schema.org JobPosting for one job page (Google for Jobs). */
export function jobPosting(j: Job) {
  const base = siteUrl();
  const c = jobContent(j);
  const description = [
    `<p>${esc(c.intro)}${c.summary ? ` ${esc(c.summary)}` : ""}</p>`,
    list("Duties", c.duties), list("Requirements", c.requirements),
    c.shift ? `<p><strong>Working hours:</strong> ${esc(c.shift)}</p>` : "",
    c.salary ? `<p><strong>Salary:</strong> ${esc(c.salary)}</p>` : "",
    list("Benefits", c.benefits),
    `<p>Apply online in about 5 minutes.</p>`,
  ].join("");
  const lo = j.salary_min, hi = j.salary_max;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: j.post,
    description,
    datePosted: istDate(j.opened_at),
    ...(j.closes_on ? { validThrough: `${j.closes_on}T23:59:59+05:30` } : {}),
    employmentType: "FULL_TIME",
    directApply: true,
    hiringOrganization: { "@type": "Organization", name: ORG, sameAs: `${base}/`, logo: `${base}/balasanka_logo.png` },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(j.branch.street_address ? { streetAddress: j.branch.street_address } : {}),
        addressLocality: j.branch.town,
        addressRegion: REGION,
        ...(j.branch.postal_code ? { postalCode: j.branch.postal_code } : {}),
        addressCountry: "IN",
      },
    },
    ...(lo || hi ? {
      baseSalary: {
        "@type": "MonetaryAmount", currency: "INR",
        value: lo && hi && hi !== lo
          ? { "@type": "QuantitativeValue", minValue: lo, maxValue: hi, unitText: "MONTH" }
          : { "@type": "QuantitativeValue", value: lo || hi, unitText: "MONTH" },
      },
    } : {}),
    url: `${base}${jobPath(j)}`,
    identifier: { "@type": "PropertyValue", name: ORG, value: j.id },
  };
}

/** When the job page last changed, for the sitemap. */
export const jobLastModified = (j: Job) => new Date(Math.max(Date.parse(j.updated_at), Date.parse(j.role?.updated_at ?? j.updated_at)));
