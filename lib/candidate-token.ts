import "server-only";
import { createPublicClient } from "./supabase/public";
import type { Candidate, OnboardingSubmission } from "./types";

/** Only the fields the letters and onboarding form show (candidate_by_token returns nothing else). */
export type TokenCandidate = Pick<Candidate, "name" | "mobile" | "address" | "father_name" | "marital_status" | "email" | "posts"
  | "applied_locations" | "designation" | "basic_salary" | "allowances" | "pipeline_status" | "expected_joining_date"
  | "revised_joining_date" | "actual_joining_date" | "employment_status" | "left_type" | "relieving_date" | "confirmation_date"
  | "offer_response" | "offer_responded_at" | "salary_status"> & { aadhaar_checked?: boolean };

export type TokenLookup =
  | { expired: true }
  | {
      expired?: false;
      candidate: TokenCandidate;
      branch: { name: string; address: string | null; business_type: string } | null;
      onboarding: Pick<OnboardingSubmission, "status" | "missing_docs"> | null;
    };

export const isToken = (t: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);

/** Candidate, branch and onboarding state behind a secret link token; { expired: true } for an old link; null if unknown. */
export async function lookupToken(token: string): Promise<TokenLookup | null> {
  if (!isToken(token)) return null;
  const { data, error } = await createPublicClient().rpc("candidate_by_token", { p_token: token });
  if (error) throw error;
  return (data as TokenLookup | null) ?? null;
}
