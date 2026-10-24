"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_TYPES, DOC_LABELS, MANDATORY_DOCS, MAX_FILE_BYTES } from "@/lib/onboarding";
import type { Candidate, OnboardingSubmission } from "@/lib/types";

const DETAIL_FIELDS = [
  "father_name", "marital_status", "wedding_date", "email", "blood_group",
  "emergency_name", "emergency_relationship", "emergency_mobile",
  "esi_number", "uan_number", "mother_name", "spouse_name", "kids_count",
  "kid_1_name", "kid_2_name", "kid_3_name", "kid_4_name", "kid_5_name",
];

export async function submitOnboarding(token: string, formData: FormData): Promise<{ ok: boolean; message: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, message: "Invalid link." };
  const admin = createAdminClient();
  const { data: c } = await admin.from("candidates").select("*").eq("access_token", token).maybeSingle<Candidate>();
  if (!c) return { ok: false, message: "This link is not valid." };
  const { data: existing } = await admin.from("onboarding_submissions").select("*").eq("candidate_id", c.id).maybeSingle<OnboardingSubmission>();
  if (existing && existing.status !== "pending") return { ok: false, message: "Your documents are already submitted. The link is locked." };

  const details: Record<string, string> = { ...(existing?.details ?? {}) };
  for (const k of DETAIL_FIELDS) {
    const v = String(formData.get(k) ?? "").trim().slice(0, 500);
    if (v) details[k] = v;
  }
  for (const req of ["blood_group", "emergency_name", "emergency_relationship", "emergency_mobile"]) {
    if (!details[req]) return { ok: false, message: "Please fill all required fields marked *." };
  }

  const files: Record<string, string> = { ...(existing?.files ?? {}) };
  for (const key of Object.keys(DOC_LABELS)) {
    const f = formData.get(key);
    if (!(f instanceof File) || f.size === 0) continue;
    if (f.size > MAX_FILE_BYTES) return { ok: false, message: `${DOC_LABELS[key]} is larger than 8 MB.` };
    if (!ALLOWED_TYPES.includes(f.type)) return { ok: false, message: `${DOC_LABELS[key]} must be a photo or PDF.` };
    const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1];
    const path = `${c.id}/${key}_${Date.now()}.${ext}`;
    const { error } = await admin.storage.from("onboarding-docs").upload(path, f, { contentType: f.type });
    if (error) return { ok: false, message: `Upload failed for ${DOC_LABELS[key]}. Please try again.` };
    files[key] = path;
  }
  const missing = MANDATORY_DOCS.filter((k) => !files[k]);
  if (missing.length) return { ok: false, message: `Please upload: ${missing.map((k) => DOC_LABELS[k]).join(", ")}.` };

  const row = { candidate_id: c.id, status: "submitted" as const, missing_docs: [], details, files, submitted_at: new Date().toISOString() };
  const { error } = await admin.from("onboarding_submissions").upsert(row, { onConflict: "candidate_id" });
  if (error) return { ok: false, message: "Could not save. Please try again." };

  if (details.father_name && !c.father_name) await admin.from("candidates").update({ father_name: details.father_name, email: details.email ?? c.email }).eq("id", c.id);
  await admin.from("notifications").insert({
    sender: c.name, recipient: c.assigned_hr,
    message: `Onboarding documents ${existing ? "re-submitted" : "submitted"} by ${c.name} (${c.mobile}). Please verify.`,
  });
  return { ok: true, message: "Submitted" };
}
