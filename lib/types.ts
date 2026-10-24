export type Role = "admin" | "hr" | "branch";

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
  form_data: Record<string, string>;
  application_folder: string | null;
  access_token: string;
  created_at: string;
  updated_at: string;
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
