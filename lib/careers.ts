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

/** The name Google shows above our search results. Without it Google guesses one for the whole domain. */
export const SITE_NAME = "Balasanka Group";

/** schema.org WebSite + Organization for the careers page, which is what the bare domain opens. */
export function siteSchema() {
  const base = siteUrl();
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      alternateName: ["Balasanka Group of Companies", "Balasanka Careers", "பாலசங்கா குழுமம்"],
      url: `${base}/`,
    },
    { "@context": "https://schema.org", "@type": "Organization", name: "Balasanka Group of Companies", url: `${base}/`, logo: `${base}/balasanka_logo.png` },
  ];
}
