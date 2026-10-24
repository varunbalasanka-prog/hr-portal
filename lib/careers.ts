import "server-only";
import { createPublicClient } from "./supabase/public";
import { loadApplyConfig, type BranchOption } from "@/app/apply/config";

export type CareerBranch = BranchOption & { urgent: { post: string; headcount: number }[] };

/** Branches with open posts, plus the posts a branch urgently needs (approved manpower requests). */
export async function loadCareers(): Promise<CareerBranch[] | null> {
  const [config, { data }] = await Promise.all([loadApplyConfig(), createPublicClient().rpc("public_careers")]);
  if (!config) return null;
  const urgent = ((data as { urgent?: { branch_id: string; post: string; headcount: number }[] } | null)?.urgent ?? []);
  return config.branches.map((b) => ({
    ...b, urgent: urgent.filter((u) => u.branch_id === b.id && b.posts.includes(u.post)).map(({ post, headcount }) => ({ post, headcount })),
  }));
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "https://hr.balasanka.in").replace(/\/$/, "");
