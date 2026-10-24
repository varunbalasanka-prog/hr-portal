"use server";
import { requireProfile } from "@/lib/auth";
import type { CandidateEvent, OnboardingSubmission } from "@/lib/types";

/** History + onboarding documents (as 10-minute signed links) for one candidate. Storage rules only sign files the user may see. */
export async function getCandidateDetails(candidateId: string) {
  const { supabase } = await requireProfile();
  // RLS check: if the user can't see the candidate, stop here.
  const { data: c } = await supabase.from("candidates").select("id, form_data").eq("id", candidateId).maybeSingle<{ id: string; form_data: Record<string, string> }>();
  if (!c) return null;

  const [{ data: events }, { data: onboarding }] = await Promise.all([
    supabase.from("candidate_events").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }),
    supabase.from("onboarding_submissions").select("*").eq("candidate_id", candidateId).maybeSingle<OnboardingSubmission>(),
  ]);

  const fileLinks: Record<string, string> = {};
  if (onboarding?.files) {
    await Promise.all(Object.entries(onboarding.files).map(async ([key, path]) => {
      if (!path || path.startsWith("http")) { if (path) fileLinks[key] = path; return; }
      const { data } = await supabase.storage.from("onboarding-docs").createSignedUrl(path, 600);
      if (data) fileLinks[key] = data.signedUrl;
    }));
  }
  // Files from the /apply page are stored as "app-file:<path>" in form_data.
  await Promise.all(Object.entries(c.form_data ?? {}).filter(([, v]) => v?.startsWith("app-file:")).map(async ([label, v]) => {
    const { data } = await supabase.storage.from("applications").createSignedUrl(v.slice("app-file:".length), 600);
    if (data) fileLinks[`form:${label}`] = data.signedUrl;
  }));
  return { events: (events ?? []) as CandidateEvent[], onboarding: onboarding ?? null, fileLinks };
}
