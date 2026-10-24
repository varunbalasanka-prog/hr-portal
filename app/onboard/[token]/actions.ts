"use server";
import { isToken } from "@/lib/candidate-token";
import { createPublicClient } from "@/lib/supabase/public";
import { DOC_LABELS } from "@/lib/onboarding";
import { CONSENT_VERSION } from "@/lib/privacy";

const DETAIL_FIELDS = [
  "father_name", "marital_status", "wedding_date", "email", "blood_group",
  "emergency_name", "emergency_relationship", "emergency_mobile",
  "esi_number", "uan_number", "mother_name", "spouse_name", "kids_count",
  "kid_1_name", "kid_2_name", "kid_3_name", "kid_4_name", "kid_5_name",
];
const REQUIRED_DETAILS = ["blood_group", "emergency_name", "emergency_relationship", "emergency_mobile"];

const RESULT_MESSAGES: Record<string, string> = {
  invalid: "This link is not valid. / இந்த இணைப்பு செல்லாது.",
  expired: "This link has expired. Please ask HR for a new link. / இந்த இணைப்பு காலாவதியானது. HR-இடம் புதிய இணைப்பைக் கேட்கவும்.",
  locked: "Your documents are already submitted. The link is locked. / உங்கள் ஆவணங்கள் ஏற்கனவே சமர்ப்பிக்கப்பட்டன.",
  missing_docs: "Please upload your Aadhaar card, school / college certificate and passport size photo. / ஆதார், சான்றிதழ், புகைப்படம் பதிவேற்றவும்.",
  bad_file: "Upload failed. Please try again. / பதிவேற்றம் தோல்வி, மீண்டும் முயற்சிக்கவும்.",
  no_consent: "Please tick the box to agree to the privacy notice. / தனியுரிமை அறிவிப்பை ஏற்க டிக் செய்யவும்.",
};
const TRY_AGAIN = "Could not save. Please try again. / சேமிக்க முடியவில்லை, மீண்டும் முயற்சிக்கவும்.";

/**
 * Runs with the public key only. The browser has already uploaded the files into "<token>/" in the private bucket
 * (the storage rule allows that only while this candidate's onboarding is open); this receives their paths,
 * then the database function records the submission and notifies HR.
 */
export async function submitOnboarding(token: string, formData: FormData): Promise<{ ok: boolean; message: string }> {
  if (!isToken(token)) return { ok: false, message: RESULT_MESSAGES.invalid };
  if (formData.get("consent") !== "yes") return { ok: false, message: RESULT_MESSAGES.no_consent };

  const details: Record<string, string> = { consent_version: CONSENT_VERSION };
  for (const k of DETAIL_FIELDS) {
    const v = String(formData.get(k) ?? "").trim().slice(0, 500);
    if (v) details[k] = v;
  }
  if (REQUIRED_DETAILS.some((k) => !details[k])) return { ok: false, message: "Please fill all required fields marked *. / * குறியிட்டவை அனைத்தையும் நிரப்பவும்." };

  const files: Record<string, string> = {};
  for (const key of Object.keys(DOC_LABELS)) {
    const path = String(formData.get(`path_${key}`) ?? "");
    if (!path) continue;
    if (!path.startsWith(`${token}/`) || path.length > 200) return { ok: false, message: RESULT_MESSAGES.bad_file };
    files[key] = path;
  }

  const { data, error } = await createPublicClient().rpc("submit_onboarding", { p_token: token, p_details: details, p_files: files });
  if (error) return { ok: false, message: TRY_AGAIN };
  if (data !== "ok") return { ok: false, message: RESULT_MESSAGES[data as string] ?? TRY_AGAIN };
  return { ok: true, message: "Submitted" };
}
