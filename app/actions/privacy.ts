"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile, requireSuperAdmin } from "@/lib/auth";
import { cleanRetention, type PrivacyContact } from "@/lib/privacy";
import { deleteCandidateFiles } from "@/lib/candidate-files";

type Result = { ok: boolean; message: string };

/** Extends a candidate's letter / onboarding link by 60 days, or replaces it so the old one stops working. */
export async function renewLink(candidateId: string, replace: boolean): Promise<Result> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("renew_candidate_link", { p_candidate: candidateId, p_replace: replace });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: replace ? "New link made. The old link no longer works." : "Link extended for 60 days." };
}

/** A person asked to be deleted (DPDP right to erasure). Super admin only; the change history keeps only that it happened. */
export async function eraseCandidate(candidateId: string): Promise<Result> {
  const { supabase } = await requireSuperAdmin();
  const fileError = await deleteCandidateFiles(supabase, candidateId);
  if (fileError) return { ok: false, message: `Files not deleted: ${fileError}` };
  const { error } = await supabase.rpc("erase_candidate", { p_candidate: candidateId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Erased. Their details, files and history are gone." };
}

/** Privacy contact shown on /privacy, and how many months closed records keep their details. */
export async function savePrivacySettings(contact: PrivacyContact, months: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const clean = Object.fromEntries(Object.entries(contact).map(([k, v]) => [k, String(v ?? "").trim().slice(0, 200)])) as PrivacyContact;
  if (!clean.name) return { ok: false, message: "Enter a name or team for the privacy contact." };
  const m = months.trim() === "" ? null : cleanRetention(months);
  if (months.trim() !== "" && m === null) return { ok: false, message: "Months must be a whole number, 6 or more (or blank to switch clean-up off)." };
  const now = new Date().toISOString();
  const { error } = await supabase.from("app_settings").upsert([
    { key: "privacy_contact", value: clean, updated_at: now },
    { key: "retention_months", value: m, updated_at: now },
  ]);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  revalidatePath("/privacy");
  return { ok: true, message: "Saved." };
}

/** How many closed records the next clean-up would strip. */
export async function previewCleanup(months: number): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("strip_old_candidates", { p_months: months, p_dry_run: true });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `${(data as string[] | null)?.length ?? 0} closed record(s) would have their details and files removed in the next nightly clean-up.` };
}
