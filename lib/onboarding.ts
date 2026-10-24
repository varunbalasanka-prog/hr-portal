/** Documents collected by the candidate onboarding form. Key = form field and storage key. */
export const DOC_LABELS: Record<string, string> = {
  aadhar: "Aadhar card",
  school_certificate: "School / college certificate",
  passport_photo: "Passport size photo",
  bank_passbook: "Bank pass book",
  pan_card: "PAN card",
  driving_license: "Driving license",
  father_aadhar: "Father Aadhar",
  father_photo: "Father photo",
  mother_aadhar: "Mother Aadhar",
  mother_photo: "Mother photo",
  spouse_aadhar: "Spouse Aadhar",
  spouse_photo: "Spouse photo",
  kid_1_aadhar: "Kid 1 Aadhar", kid_1_photo: "Kid 1 photo",
  kid_2_aadhar: "Kid 2 Aadhar", kid_2_photo: "Kid 2 photo",
  kid_3_aadhar: "Kid 3 Aadhar", kid_3_photo: "Kid 3 photo",
  kid_4_aadhar: "Kid 4 Aadhar", kid_4_photo: "Kid 4 photo",
  kid_5_aadhar: "Kid 5 Aadhar", kid_5_photo: "Kid 5 photo",
};

export const MANDATORY_DOCS = ["aadhar", "school_certificate", "passport_photo"];

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const RELATIONSHIPS = ["Father", "Mother", "Spouse", "Brother", "Sister", "Friend", "Other"];
