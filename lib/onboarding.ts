/** Documents collected by the candidate onboarding form. Key = form field and storage key.
 *  Labels are "English / Tamil"; staff screens show the English part. */
export const DOC_LABELS: Record<string, string> = {
  aadhar: "Aadhaar card (masked) / ஆதார் அட்டை (மறைக்கப்பட்டது)",
  school_certificate: "School / college certificate / பள்ளி / கல்லூரிச் சான்றிதழ்",
  passport_photo: "Passport size photo / பாஸ்போர்ட் அளவு புகைப்படம்",
  bank_passbook: "Bank pass book / வங்கிக் கணக்குப் புத்தகம்",
  pan_card: "PAN card / பான் அட்டை",
  driving_license: "Driving license / ஓட்டுநர் உரிமம்",
  father_aadhar: "Father Aadhaar (masked) / தந்தை ஆதார்",
  father_photo: "Father photo / தந்தை புகைப்படம்",
  mother_aadhar: "Mother Aadhaar (masked) / தாய் ஆதார்",
  mother_photo: "Mother photo / தாய் புகைப்படம்",
  spouse_aadhar: "Spouse Aadhaar (masked) / வாழ்க்கைத் துணை ஆதார்",
  spouse_photo: "Spouse photo / வாழ்க்கைத் துணை புகைப்படம்",
  kid_1_aadhar: "Child 1 Aadhaar (masked) / குழந்தை 1 ஆதார்", kid_1_photo: "Child 1 photo / குழந்தை 1 புகைப்படம்",
  kid_2_aadhar: "Child 2 Aadhaar (masked) / குழந்தை 2 ஆதார்", kid_2_photo: "Child 2 photo / குழந்தை 2 புகைப்படம்",
  kid_3_aadhar: "Child 3 Aadhaar (masked) / குழந்தை 3 ஆதார்", kid_3_photo: "Child 3 photo / குழந்தை 3 புகைப்படம்",
  kid_4_aadhar: "Child 4 Aadhaar (masked) / குழந்தை 4 ஆதார்", kid_4_photo: "Child 4 photo / குழந்தை 4 புகைப்படம்",
  kid_5_aadhar: "Child 5 Aadhaar (masked) / குழந்தை 5 ஆதார்", kid_5_photo: "Child 5 photo / குழந்தை 5 புகைப்படம்",
};

/** English part of a document label, for staff screens. */
export const docLabel = (key: string) => (DOC_LABELS[key] ?? key).split(" / ")[0];

export const MANDATORY_DOCS = ["aadhar", "school_certificate", "passport_photo"];

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const RELATIONSHIPS = ["Father / தந்தை", "Mother / தாய்", "Spouse / வாழ்க்கைத் துணை", "Brother / சகோதரர்", "Sister / சகோதரி", "Friend / நண்பர்", "Other / மற்றவை"];
