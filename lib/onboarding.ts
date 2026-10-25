/** Documents collected by the candidate onboarding form. Key = form field and storage key.
 *  Labels are "English / Tamil"; staff screens show the English part. */
export const DOC_LABELS: Record<string, string> = {
  aadhar: "Aadhaar card (full, not masked) / ஆதார் அட்டை (முழுமையானது)",
  school_certificate: "School / college certificate / பள்ளி / கல்லூரிச் சான்றிதழ்",
  passport_photo: "Passport size photo / பாஸ்போர்ட் அளவு புகைப்படம்",
  bank_passbook: "Bank pass book / வங்கிக் கணக்குப் புத்தகம்",
  pan_card: "PAN card / பான் அட்டை",
  driving_license: "Driving license / ஓட்டுநர் உரிமம்",
  father_aadhar: "Father Aadhaar / தந்தை ஆதார்",
  father_photo: "Father photo / தந்தை புகைப்படம்",
  mother_aadhar: "Mother Aadhaar / தாய் ஆதார்",
  mother_photo: "Mother photo / தாய் புகைப்படம்",
  spouse_aadhar: "Spouse Aadhaar / வாழ்க்கைத் துணை ஆதார்",
  spouse_photo: "Spouse photo / வாழ்க்கைத் துணை புகைப்படம்",
  kid_1_aadhar: "Child 1 Aadhaar / குழந்தை 1 ஆதார்", kid_1_photo: "Child 1 photo / குழந்தை 1 புகைப்படம்",
  kid_2_aadhar: "Child 2 Aadhaar / குழந்தை 2 ஆதார்", kid_2_photo: "Child 2 photo / குழந்தை 2 புகைப்படம்",
  kid_3_aadhar: "Child 3 Aadhaar / குழந்தை 3 ஆதார்", kid_3_photo: "Child 3 photo / குழந்தை 3 புகைப்படம்",
  kid_4_aadhar: "Child 4 Aadhaar / குழந்தை 4 ஆதார்", kid_4_photo: "Child 4 photo / குழந்தை 4 புகைப்படம்",
  kid_5_aadhar: "Child 5 Aadhaar / குழந்தை 5 ஆதார்", kid_5_photo: "Child 5 photo / குழந்தை 5 புகைப்படம்",
};

/** Details HR can ask the candidate to correct. Flagged as "field:<key>" in missing_docs, next to document keys. */
export const DETAIL_LABELS: Record<string, string> = {
  father_name: "Father's / husband's name / தந்தை / கணவர் பெயர்",
  wedding_date: "Wedding date / திருமண தேதி",
  email: "Email / மின்னஞ்சல்",
  blood_group: "Blood group / இரத்த வகை",
  emergency_name: "Emergency contact name / அவசரத் தொடர்பு நபர் பெயர்",
  emergency_relationship: "Emergency contact relationship / உறவு",
  emergency_mobile: "Emergency contact mobile / அவசரத் தொடர்பு கைபேசி",
  esi_number: "ESI number / ESI எண்",
  uan_number: "UAN number / UAN எண்",
  mother_name: "Mother name / தாய் பெயர்",
  spouse_name: "Spouse name / வாழ்க்கைத் துணை பெயர்",
  kid_1_name: "Child 1 name / குழந்தை 1 பெயர்", kid_2_name: "Child 2 name / குழந்தை 2 பெயர்", kid_3_name: "Child 3 name / குழந்தை 3 பெயர்",
  kid_4_name: "Child 4 name / குழந்தை 4 பெயர்", kid_5_name: "Child 5 name / குழந்தை 5 பெயர்",
};
export const FIELD_FLAG = "field:";

/** Bilingual label of a flagged item (document key or "field:<key>"). */
export const itemLabelFull = (key: string) =>
  key.startsWith(FIELD_FLAG) ? DETAIL_LABELS[key.slice(FIELD_FLAG.length)] ?? key.slice(FIELD_FLAG.length) : DOC_LABELS[key] ?? key;

/** English part of a document (or flagged detail) label, for staff screens. */
export const docLabel = (key: string) => itemLabelFull(key).split(" / ")[0];

export const MANDATORY_DOCS = ["aadhar", "school_certificate", "passport_photo"];

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const RELATIONSHIPS = ["Father / தந்தை", "Mother / தாய்", "Spouse / வாழ்க்கைத் துணை", "Brother / சகோதரர்", "Sister / சகோதரி", "Friend / நண்பர்", "Other / மற்றவை"];

/** Gross above this is outside ESI, so the form asks for a UAN (PF) number instead of an ESI number. */
export const ESI_GROSS_LIMIT = 21000;
export const insuranceQuestion = (gross: number): "esi" | "uan" => (gross > ESI_GROSS_LIMIT ? "uan" : "esi");

/** "Single" in older records means unmarried. Returns "" when not known. */
export function normalizeMarital(v?: string | null): "Married" | "Unmarried" | "" {
  const s = (v ?? "").toLowerCase();
  if (s.startsWith("married")) return "Married";
  if (s.startsWith("unmarried") || s.startsWith("single")) return "Unmarried";
  return "";
}

/** What the family section needs when the candidate has no ESI / UAN number yet (a "Yes" skips the family section).
 *  Married: spouse, and the number of children with each child's name, Aadhaar and photo. Unmarried: father and mother. */
export function familyRequirements(marital: string, kids: number): { fields: string[]; docs: string[] } {
  if (normalizeMarital(marital) === "Married") {
    const fields = ["spouse_name", "kids_count"];
    const docs = ["spouse_aadhar", "spouse_photo"];
    for (let i = 1; i <= Math.min(Math.max(kids, 0), 5); i++) {
      fields.push(`kid_${i}_name`);
      docs.push(`kid_${i}_aadhar`, `kid_${i}_photo`);
    }
    return { fields, docs };
  }
  return { fields: ["mother_name"], docs: ["father_aadhar", "father_photo", "mother_aadhar", "mother_photo"] };
}

/** Loose name match (case, spaces, dots and initials ignored) to warn HR when the Aadhaar belongs to someone else. */
export function namesMatch(a: string, b: string): boolean {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((w) => long.includes(w));
}
