import "server-only";
import { createPublicClient } from "./supabase/public";
import { loadApplyConfig, type BranchOption } from "@/app/apply/config";

export type CareerBranch = BranchOption & { urgent: { post: string; headcount: number }[] };
/** postedAt: when admin last changed which posts are open (null until migration 0017 has run). */
export type CareerListing = { branches: CareerBranch[]; postedAt: string | null };

/** Branches with open posts, plus the posts a branch urgently needs (approved manpower requests). */
export async function loadCareerListing(): Promise<CareerListing | null> {
  const [config, { data }] = await Promise.all([loadApplyConfig(), createPublicClient().rpc("public_careers")]);
  if (!config) return null;
  const extra = (data ?? {}) as { urgent?: { branch_id: string; post: string; headcount: number }[]; posted_at?: string | null };
  const urgent = extra.urgent ?? [];
  return {
    postedAt: extra.posted_at ?? null,
    branches: config.branches.map((b) => ({
      ...b, urgent: urgent.filter((u) => u.branch_id === b.id && b.posts.includes(u.post)).map(({ post, headcount }) => ({ post, headcount })),
    })),
  };
}

export async function loadCareers(): Promise<CareerBranch[] | null> {
  return (await loadCareerListing())?.branches ?? null;
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "https://hr.balasanka.in").replace(/\/$/, "");

const REGION = "Tamil Nadu";

/** schema.org JobPosting entries, one per open post per branch, so Google for Jobs and AI assistants can list them.
 *  Left out until posted_at is known: Google requires a real posting date. */
export function jobPostings({ branches, postedAt }: CareerListing) {
  if (!postedAt) return [];
  const base = siteUrl();
  const date = postedAt.slice(0, 10);
  return branches.flatMap((b) => b.posts.map((post) => ({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: post,
    description: `<p>${post} at ${b.name}, a ${b.business_type.toLowerCase()} showroom of Balasanka Group of Companies in ${b.town}, ${REGION}.`
      + ` Full-time job. Apply online in 5 minutes at ${base}/apply?branch=${b.id}. Freshers and experienced candidates can apply.</p>`,
    datePosted: date,
    employmentType: "FULL_TIME",
    directApply: true,
    hiringOrganization: { "@type": "Organization", name: "Balasanka Group of Companies", sameAs: base, logo: `${base}/balasanka_logo.png` },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: b.town, addressRegion: REGION, addressCountry: "IN" } },
    url: `${base}/apply?branch=${b.id}`,
    identifier: { "@type": "PropertyValue", name: b.name, value: `${b.id}:${post}` },
  })));
}
