import "server-only";
import { createPublicClient } from "./supabase/public";
import type { Branch, Candidate, OnboardingSubmission } from "./types";

export type TokenLookup = {
  candidate: Omit<Candidate, "form_data">;
  branch: Branch | null;
  onboarding: Pick<OnboardingSubmission, "status" | "missing_docs"> | null;
};

export const isToken = (t: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);

/** Candidate, branch and onboarding state behind a secret link token, or null. */
export async function lookupToken(token: string): Promise<TokenLookup | null> {
  if (!isToken(token)) return null;
  const { data, error } = await createPublicClient().rpc("candidate_by_token", { p_token: token });
  if (error) throw error;
  return (data as TokenLookup | null) ?? null;
}
