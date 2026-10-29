export type Role = "superadmin" | "admin" | "hr" | "branch";

/** Super admins can do everything admins can. */
export const isAdminRole = (role: Role) => role === "admin" || role === "superadmin";

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  branch_id: string | null;
  mobile: string | null;
  photo_path: string | null;
}

export interface Branch {
  id: string;
  name: string;
  town: string;
  address: string | null;
  business_type: string;
  hr_username: string;
  /** Group of stores (0019). Defaults to the brand before " - " in the name. */
  division?: string | null;
  /** Split from address for Google job listings (0024). */
  street_address?: string | null;
  postal_code?: string | null;
}

export interface Candidate {
  id: string;
  source: "online" | "walkin";
  name: string;
  mobile: string;
  marital_status: string | null;
  father_name: string | null;
  email: string | null;
  address: string | null;
  posts: string[];
  applied_locations: string[];
  branch_id: string | null;
  assigned_hr: string;
  entry_by: string | null;
  received_at: string;
  pipeline_status: string;
  next_action: string | null;
  next_action_at: string | null;
  calling_status: string | null;
  calling_action: string | null;
  first_call_at: string | null;
  first_retry_status: string | null;
  first_retry_at: string | null;
  second_retry_status: string | null;
  second_retry_at: string | null;
  third_retry_status: string | null;
  third_retry_at: string | null;
  interview_at: string | null;
  interview_attendance: string | null;
  interview_status: string | null;
  not_attended_reason: string | null;
  reschedule_at: string | null;
  reschedule_attendance: string | null;
  reminder_status: string | null;
  reminder_at: string | null;
  designation: string | null;
  basic_salary: number;
  allowances: number;
  expected_joining_date: string | null;
  joining_status: string | null;
  not_joined_reason: string | null;
  revised_joining_date: string | null;
  revised_joining_status: string | null;
  actual_joining_date: string | null;
  employment_status: string | null;
  left_type: string | null;
  relieving_date: string | null;
  rejection_reason: string | null;
  interview_needed: boolean | null;
  source_channel: string | null;
  referred_by: string | null;
  talent_pool: boolean;
  talent_tags: string[];
  offer_response: "accepted" | "declined" | null;
  offer_responded_at: string | null;
  offer_decline_reason: string | null;
  confirmation_date: string | null;
  confirmation_approved_by: string | null;
  confirmation_approved_at: string | null;
  last_sms_key: string | null;
  last_sms_at: string | null;
  employee_code: string | null;
  shift_time: string | null;
  store_details_at: string | null;
  payroll_completed_at: string | null;
  payroll_completed_by: string | null;
  reapply_review: boolean;
  reapply_at: string | null;
  proposed_basic: number | null;
  proposed_allowances: number | null;
  salary_status: "proposed" | "approved" | null;
  salary_approved_by: string | null;
  salary_approved_at: string | null;
  aadhaar_check: AadhaarCheck | null;
  created_at: string;
  updated_at: string;
}

/** Columns the dashboard, reports and pipeline need. Application answers and the link token stay out of the list and
 *  are loaded only when a candidate is opened (see getCandidateDetails). */
export const CANDIDATE_COLUMNS = [
  "id", "source", "name", "mobile", "marital_status", "father_name", "email", "address", "posts", "applied_locations",
  "branch_id", "assigned_hr", "entry_by", "received_at", "pipeline_status", "next_action", "next_action_at",
  "calling_status", "calling_action", "first_call_at", "first_retry_status", "first_retry_at", "second_retry_status",
  "second_retry_at", "third_retry_status", "third_retry_at", "interview_at", "interview_attendance", "interview_status",
  "not_attended_reason", "reschedule_at", "reschedule_attendance", "reminder_status", "reminder_at", "designation",
  "basic_salary", "allowances", "expected_joining_date", "joining_status", "not_joined_reason", "revised_joining_date",
  "revised_joining_status", "actual_joining_date", "employment_status", "left_type", "relieving_date", "rejection_reason",
  "interview_needed", "source_channel", "referred_by", "talent_pool", "talent_tags", "offer_response", "offer_responded_at",
  "offer_decline_reason", "confirmation_date", "confirmation_approved_by", "confirmation_approved_at", "last_sms_key", "last_sms_at", "employee_code", "shift_time", "store_details_at",
  "payroll_completed_at", "payroll_completed_by", "reapply_review", "reapply_at", "proposed_basic", "proposed_allowances", "salary_status", "salary_approved_by", "salary_approved_at",
  "aadhaar_check", "created_at", "updated_at",
].join(", ");

/** Result of the free Aadhaar check (UIDAI Secure QR, offline e-KYC file) or HR seeing it in person. Never the full number. */
export interface AadhaarCheck {
  method: "secure qr" | "e-kyc" | "in person";
  name?: string;
  dob?: string;
  gender?: string;
  last4?: string;
  by?: string;
  at: string;
}

export interface OnboardingSubmission {
  id: string;
  candidate_id: string;
  status: "submitted" | "pending" | "completed";
  missing_docs: string[];
  details: Record<string, string>;
  files: Record<string, string>;
  employee_code: string | null;
  shift_time: string | null;
  submitted_at: string;
}

export interface CandidateEvent {
  id: number;
  candidate_id: string;
  actor: string;
  stage: string;
  from_status: string | null;
  to_status: string | null;
  details: Record<string, unknown>;
  remark: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: number;
  sender: string;
  recipient: string;
  message: string;
  file_path: string | null;
  created_at: string;
  viewed_at?: string | null;
  cleared_at?: string | null;
}
