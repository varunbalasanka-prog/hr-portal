"use server";
import { isToken, lookupToken } from "@/lib/candidate-token";
import { createPublicClient } from "@/lib/supabase/public";
import { DOC_LABELS, FIELD_FLAG, MANDATORY_DOCS, familyRequirements, insuranceQuestion, normalizeMarital } from "@/lib/onboarding";
import { CONSENT_VERSION } from "@/lib/privacy";
import { verifyEkycZip, verifySecureQr, type AadhaarError, type AadhaarResult } from "@/lib/aadhaar";

const DETAIL_FIELDS = [
  "father_name", "marital_status", "wedding_date", "email", "blood_group",
  "emergency_name", "emergency_relationship", "emergency_mobile",
  "esi_status", "esi_number", "uan_status", "uan_number", "mother_name", "spouse_name", "kids_count",
  "kid_1_name", "kid_2_name", "kid_3_name", "kid_4_name", "kid_5_name",
];
const REQUIRED_DETAILS = ["father_name", "email", "blood_group", "emergency_name", "emergency_relationship", "emergency_mobile"];

const RESULT_MESSAGES: Record<string, string> = {
  invalid: "This link is not valid. / இந்த இணைப்பு செல்லாது.",
  expired: "This link has expired. Please ask HR for a new link. / இந்த இணைப்பு காலாவதியானது. HR-இடம் புதிய இணைப்பைக் கேட்கவும்.",
  locked: "Your documents are already submitted. The link is locked. / உங்கள் ஆவணங்கள் ஏற்கனவே சமர்ப்பிக்கப்பட்டன.",
  missing_docs: "Please upload your Aadhaar card, school / college certificate and passport size photo. / ஆதார், சான்றிதழ், புகைப்படம் பதிவேற்றவும்.",
  bad_file: "Upload failed. Please try again. / பதிவேற்றம் தோல்வி, மீண்டும் முயற்சிக்கவும்.",
  no_consent: "Please tick the box to agree to the privacy notice. / தனியுரிமை அறிவிப்பை ஏற்க டிக் செய்யவும்.",
  family: "Please fill the family details and upload their Aadhaar and photos (needed because you don't have an ESI / UAN number yet). / குடும்ப விவரங்களை நிரப்பி அவர்களின் ஆதார், புகைப்படங்களைப் பதிவேற்றவும்.",
  flagged: "Please fill / upload every item HR asked for. / HR கேட்ட அனைத்தையும் நிரப்பவும் / பதிவேற்றவும்.",
};
const REQUIRED = "Please fill all required fields marked *. / * குறியிட்டவை அனைத்தையும் நிரப்பவும்.";
const TRY_AGAIN = "Could not save. Please try again. / சேமிக்க முடியவில்லை, மீண்டும் முயற்சிக்கவும்.";

/**
 * Runs with the public key only. The browser has already uploaded the files into "<token>/" in the private bucket
 * (the storage rule allows that only while this candidate's onboarding is open); this receives their paths,
 * then the database function records the submission and notifies HR.
 */
export async function submitOnboarding(token: string, formData: FormData): Promise<{ ok: boolean; message: string }> {
  if (!isToken(token)) return { ok: false, message: RESULT_MESSAGES.invalid };
  if (formData.get("consent") !== "yes") return { ok: false, message: RESULT_MESSAGES.no_consent };
  const found = await lookupToken(token).catch(() => null);
  if (!found) return { ok: false, message: RESULT_MESSAGES.invalid };
  if (found.expired) return { ok: false, message: RESULT_MESSAGES.expired };

  const details: Record<string, string> = { consent_version: CONSENT_VERSION };
  for (const k of DETAIL_FIELDS) {
    const v = String(formData.get(k) ?? "").trim().slice(0, 500);
    if (v) details[k] = v;
  }
  const files: Record<string, string> = {};
  for (const key of Object.keys(DOC_LABELS)) {
    const path = String(formData.get(`path_${key}`) ?? "");
    if (!path) continue;
    if (!path.startsWith(`${token}/`) || path.length > 200) return { ok: false, message: RESULT_MESSAGES.bad_file };
    files[key] = path;
  }

  const c = found.candidate;
  const sub = found.onboarding;
  if (sub?.status === "pending") {
    // Re-upload link: only the items HR flagged are asked for, and each one must come back.
    const flagged = sub.missing_docs ?? [];
    if (flagged.some((k) => (k.startsWith(FIELD_FLAG) ? !details[k.slice(FIELD_FLAG.length)] : !files[k]))) return { ok: false, message: RESULT_MESSAGES.flagged };
  } else {
    // Marital status comes from the application when it is known; the candidate can't change it here.
    const marital = normalizeMarital(c.marital_status) || normalizeMarital(details.marital_status);
    if (!marital) return { ok: false, message: REQUIRED };
    details.marital_status = marital;
    if (REQUIRED_DETAILS.some((k) => !details[k])) return { ok: false, message: REQUIRED };
    if (MANDATORY_DOCS.some((k) => !files[k])) return { ok: false, message: RESULT_MESSAGES.missing_docs };

    // ESI if the gross salary is ₹21,000 or less, otherwise UAN (PF). Having the number skips the family section.
    const q = insuranceQuestion(Number(c.basic_salary || 0) + Number(c.allowances || 0));
    const status = details[`${q}_status`];
    if (status !== "Yes" && status !== "No") return { ok: false, message: REQUIRED };
    for (const k of ["esi", "uan"].filter((x) => x !== q)) { delete details[`${k}_status`]; delete details[`${k}_number`]; }
    if (status === "Yes") {
      if (!details[`${q}_number`]) return { ok: false, message: REQUIRED };
      for (const k of Object.keys(details)) if (/^(mother_name|spouse_name|kids_count|kid_\d_name)$/.test(k)) delete details[k];
      for (const k of Object.keys(files)) if (/^(father|mother|spouse|kid_\d)_/.test(k)) delete files[k];
    } else {
      delete details[`${q}_number`];
      const kids = Number(details.kids_count ?? "");
      if (marital === "Married" && !(Number.isInteger(kids) && kids >= 0 && kids <= 5)) return { ok: false, message: RESULT_MESSAGES.family };
      const need = familyRequirements(marital, kids);
      if (need.fields.some((k) => !details[k]) || need.docs.some((k) => !files[k])) return { ok: false, message: RESULT_MESSAGES.family };
    }
  }

  const { data, error } = await createPublicClient().rpc("submit_onboarding", { p_token: token, p_details: details, p_files: files });
  if (error) return { ok: false, message: TRY_AGAIN };
  if (data !== "ok") return { ok: false, message: RESULT_MESSAGES[data as string] ?? TRY_AGAIN };
  return { ok: true, message: "Submitted" };
}

const AADHAAR_MESSAGES: Record<AadhaarError, string> = {
  off: "Aadhaar check is not available right now. HR will check your original Aadhaar. / ஆதார் சரிபார்ப்பு இப்போது இல்லை; HR உங்கள் அசல் ஆதாரைச் சரிபார்ப்பார்.",
  unreadable: "Could not read it. Try a clearer photo of the QR, or the e-KYC file. / படிக்க முடியவில்லை. QR-இன் தெளிவான புகைப்படம் அல்லது e-KYC கோப்பை முயற்சிக்கவும்.",
  bad_signature: "This is not a genuine UIDAI Aadhaar QR / file. / இது உண்மையான UIDAI ஆதார் QR / கோப்பு அல்ல.",
  bad_code: "Wrong share code. Use the 4-character code you typed when downloading the file. / தவறான பகிர்வுக் குறியீடு.",
};

type AadhaarReply = { ok: boolean; message: string; name?: string };

async function saveAadhaar(token: string, r: AadhaarResult | AadhaarError): Promise<AadhaarReply> {
  if (typeof r === "string") return { ok: false, message: AADHAAR_MESSAGES[r] };
  const { data, error } = await createPublicClient().rpc("record_aadhaar_check", { p_token: token, p_result: r, p_secret: process.env.APPLY_SECRET ?? "" });
  if (error || data !== "ok") return { ok: false, message: data === "expired" ? RESULT_MESSAGES.expired : TRY_AGAIN };
  return { ok: true, message: "Aadhaar verified / ஆதார் சரிபார்க்கப்பட்டது", name: r.name };
}

/** The text read from the Aadhaar Secure QR (by the phone camera or from a photo). */
export async function verifyAadhaarQr(token: string, qrText: string): Promise<AadhaarReply> {
  if (!isToken(token) || typeof qrText !== "string" || qrText.length > 20000) return { ok: false, message: RESULT_MESSAGES.invalid };
  return saveAadhaar(token, verifySecureQr(qrText));
}

/** The offline e-KYC ZIP from myaadhaar.uidai.gov.in and its share code. */
export async function verifyAadhaarFile(token: string, formData: FormData): Promise<AadhaarReply> {
  if (!isToken(token)) return { ok: false, message: RESULT_MESSAGES.invalid };
  const file = formData.get("zip");
  const code = String(formData.get("share_code") ?? "").trim();
  if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024) return { ok: false, message: AADHAAR_MESSAGES.unreadable };
  if (!/^.{4}$/.test(code)) return { ok: false, message: AADHAAR_MESSAGES.bad_code };
  return saveAadhaar(token, await verifyEkycZip(file, code));
}
