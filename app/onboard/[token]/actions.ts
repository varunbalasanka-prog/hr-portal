"use server";
import { isToken } from "@/lib/candidate-token";
import { createPublicClient } from "@/lib/supabase/public";
import { ALLOWED_TYPES, DOC_LABELS, MAX_FILE_BYTES } from "@/lib/onboarding";

const DETAIL_FIELDS = [
  "father_name", "marital_status", "wedding_date", "email", "blood_group",
  "emergency_name", "emergency_relationship", "emergency_mobile",
  "esi_number", "uan_number", "mother_name", "spouse_name", "kids_count",
  "kid_1_name", "kid_2_name", "kid_3_name", "kid_4_name", "kid_5_name",
];
const REQUIRED_DETAILS = ["blood_group", "emergency_name", "emergency_relationship", "emergency_mobile"];

const RESULT_MESSAGES: Record<string, string> = {
  invalid: "This link is not valid.",
  locked: "Your documents are already submitted. The link is locked.",
  missing_docs: "Please upload your Aadhar card, school / college certificate and passport size photo.",
  bad_file: "Upload failed. Please try again.",
};

/**
 * Runs with the public key only. Files go into "<token>/" in the private bucket (the storage policy
 * allows that only while this candidate's onboarding is open), then the database function records
 * the submission and notifies HR.
 */
export async function submitOnboarding(token: string, formData: FormData): Promise<{ ok: boolean; message: string }> {
  if (!isToken(token)) return { ok: false, message: RESULT_MESSAGES.invalid };

  const details: Record<string, string> = {};
  for (const k of DETAIL_FIELDS) {
    const v = String(formData.get(k) ?? "").trim().slice(0, 500);
    if (v) details[k] = v;
  }
  if (REQUIRED_DETAILS.some((k) => !details[k])) return { ok: false, message: "Please fill all required fields marked *." };

  const uploads: [string, File][] = [];
  for (const key of Object.keys(DOC_LABELS)) {
    const f = formData.get(key);
    if (!(f instanceof File) || f.size === 0) continue;
    if (f.size > MAX_FILE_BYTES) return { ok: false, message: `${DOC_LABELS[key]} is larger than 8 MB.` };
    if (!ALLOWED_TYPES.includes(f.type)) return { ok: false, message: `${DOC_LABELS[key]} must be a photo or PDF.` };
    uploads.push([key, f]);
  }

  const db = createPublicClient();
  const files: Record<string, string> = {};
  for (const [key, f] of uploads) {
    const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1];
    const path = `${token}/${key}_${Date.now()}.${ext}`;
    const { error } = await db.storage.from("onboarding-docs").upload(path, f, { contentType: f.type });
    if (error) return { ok: false, message: `Upload failed for ${DOC_LABELS[key]}. Please try again.` };
    files[key] = path;
  }

  const { data, error } = await db.rpc("submit_onboarding", { p_token: token, p_details: details, p_files: files });
  if (error) return { ok: false, message: "Could not save. Please try again." };
  if (data !== "ok") return { ok: false, message: RESULT_MESSAGES[data as string] ?? "Could not save. Please try again." };
  return { ok: true, message: "Submitted" };
}
