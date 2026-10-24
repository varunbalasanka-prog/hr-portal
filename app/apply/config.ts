import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import type { ApplyQuestion } from "@/lib/apply-questions";

/** Only branches with at least one open post, each with its open posts. */
export type BranchOption = { id: string; name: string; town: string; business_type: string; posts: string[] };
export type ApplyConfig = { branches: BranchOption[]; questions: ApplyQuestion[] };

/** The live branches, posts and questions, read with the public key. */
export async function loadApplyConfig(): Promise<ApplyConfig | null> {
  const { data, error } = await createPublicClient().rpc("public_apply_config");
  if (error || !data) return null;
  return data as ApplyConfig;
}
