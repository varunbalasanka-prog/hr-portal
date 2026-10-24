"use server";
import { requireProfile } from "@/lib/auth";
import type { CandidateEvent, OnboardingSubmission } from "@/lib/types";
import type { ScoreRow } from "@/lib/scorecard";
import { whatsappApiEnabled } from "@/lib/whatsapp-api";

export type ApplicationRow = { id: string; ref: string; post: string; branch_id: string | null; form_data: Record<string, string>; submitted_at: string };

export type CandidateDetails = {
  events: CandidateEvent[];
  onboarding: OnboardingSubmission | null;
  fileLinks: Record<string, string>;
  formData: Record<string, string>;
  applications: ApplicationRow[];
  accessToken: string;
  tokenExpiresAt: string;
  scores: ScoreRow[];
  whatsappApi: boolean;
};

/** History, answers, link token and documents (as 10-minute signed links) for one candidate.
 *  The dashboard list doesn't load these, so they only reach the browser when a candidate is opened. */
export async function getCandidateDetails(candidateId: string): Promise<CandidateDetails | null> {
  const { supabase } = await requireProfile();
  // RLS check: if the user can't see the candidate, stop here.
  const { data: c } = await supabase.from("candidates").select("id, form_data, access_token, token_expires_at").eq("id", candidateId)
    .maybeSingle<{ id: string; form_data: Record<string, string>; access_token: string; token_expires_at: string }>();
  if (!c) return null;

  const [{ data: events }, { data: onboarding }, { data: apps }, { data: scores }] = await Promise.all([
    supabase.from("candidate_events").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }),
    supabase.from("onboarding_submissions").select("*").eq("candidate_id", candidateId).maybeSingle<OnboardingSubmission>(),
    supabase.from("applications").select("id, ref, post, branch_id, form_data, submitted_at").eq("candidate_id", candidateId).order("submitted_at", { ascending: false }),
    supabase.from("interview_scores").select("id, interviewer, ratings, overall, recommendation, notes, created_at").eq("candidate_id", candidateId).order("created_at", { ascending: false }),
  ]);
  const applications = (apps ?? []) as ApplicationRow[];

  const fileLinks: Record<string, string> = {};
  if (onboarding?.files) {
    await Promise.all(Object.entries(onboarding.files).map(async ([key, path]) => {
      if (!path || path.startsWith("http")) { if (path) fileLinks[key] = path; return; }
      const { data } = await supabase.storage.from("onboarding-docs").createSignedUrl(path, 600);
      if (data) fileLinks[key] = data.signedUrl;
    }));
  }
  // Files from the /apply page are stored as "app-file:<path>" in the answers.
  const appFiles = [
    ...Object.entries(c.form_data ?? {}).map(([label, v]) => [`form:${label}`, v] as const),
    ...applications.flatMap((a) => Object.entries(a.form_data ?? {}).map(([label, v]) => [`app:${a.id}:${label}`, v] as const)),
  ].filter(([, v]) => v?.startsWith("app-file:"));
  await Promise.all(appFiles.map(async ([key, v]) => {
    const { data } = await supabase.storage.from("applications").createSignedUrl(v.slice("app-file:".length), 600);
    if (data) fileLinks[key] = data.signedUrl;
  }));
  return {
    events: (events ?? []) as CandidateEvent[], onboarding: onboarding ?? null, fileLinks,
    formData: c.form_data ?? {}, applications, accessToken: c.access_token, tokenExpiresAt: c.token_expires_at,
    scores: (scores ?? []) as ScoreRow[], whatsappApi: whatsappApiEnabled(),
  };
}
