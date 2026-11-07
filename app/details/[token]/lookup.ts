import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { isToken } from "@/lib/candidate-token";
import type { ApplyQuestion } from "@/lib/apply-questions";

export type DetailsLookup = { expired: true } | { expired?: false; name: string; submitted_at: string | null; questions: ApplyQuestion[] };

/** The candidate behind a details link and the after-interview questions they haven't answered yet; null if unknown. */
export async function lookupDetails(token: string): Promise<DetailsLookup | null> {
  if (!isToken(token)) return null;
  const { data, error } = await createPublicClient().rpc("details_by_token", { p_token: token });
  if (error) throw error;
  return (data as DetailsLookup | null) ?? null;
}
