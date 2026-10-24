/** Field labels match the old Google Form's columns, so imported and new applications look the same to HR. */
export const APPLY_TEXT_FIELDS: Record<string, string> = {
  gender: "Gender",
  dob: "Date Of Birth",
  qualification: "Educational Qualification",
  experience_level: "Are you a Fresher or Experienced? / நீங்கள் Fresher-ஆ அல்லது முன் அனுபவம் உள்ளவரா?",
  last_company: "Name of the Last Worked Company & Total Experience",
  last_salary: "Last Drawn Salary",
  expected_salary: "Expected Salary",
};

export const APPLY_FILE_FIELDS: Record<string, string> = {
  photo: "Passport Size Photo",
  resume: "Resume or Biodata",
  experience_certificate: "Experience Certificate",
  salary_proof: "Salary Proof",
};
export const REQUIRED_FILES = ["photo"];

export const POSTS = [
  "Executive Sales", "Retail Sales Officer", "Jewellery Consultant", "Floor Supervisor", "Store Manager", "Cashier",
  "Executive Accounts", "Data Entry Operator", "Customer Care Executive", "Customer Care Manager", "Receptionist",
  "HR Executive", "Digital Marketing", "Service Advisor", "Manager Service", "Manager Spares", "Technician",
  "Assistant Technician", "Incharge PDI", "Electrician", "Helper", "House Keeping",
];
