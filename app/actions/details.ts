"use server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CandidateEvent, OnboardingSubmission } from "@/lib/types";

/** History + onboarding documents (as 10-minute signed links) for one candidate. */
export async function getCandidateDetails(candidateId: string) {
  const { supabase } = await requireProfile();
  // RLS check: if the user can't see the candidate, stop here.
  const { data: c } = await supabase.from("candidates").select("id").eq("id", candidateId).maybeSingle();
  if (!c) return null;

  const [{ data: events }, { data: onboarding }] = await Promise.all([
    supabase.from("candidate_events").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }),
    supabase.from("onboarding_submissions").select("*").eq("candidate_id", candidateId).maybeSingle<OnboardingSubmission>(),
  ]);

  const fileLinks: Record<string, string> = {};
  if (onboarding?.files) {
    const admin = createAdminClient();
    await Promise.all(Object.entries(onboarding.files).map(async ([key, path]) => {
      if (!path || path.startsWith("http")) { if (path) fileLinks[key] = path; return; }
      const { data } = await admin.storage.from("onboarding-docs").createSignedUrl(path, 600);
      if (data) fileLinks[key] = data.signedUrl;
    }));
  }
  return { events: (events ?? []) as CandidateEvent[], onboarding: onboarding ?? null, fileLinks };
}
