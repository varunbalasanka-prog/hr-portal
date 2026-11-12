// Turns change-history rows (audit_log) into plain words for the super admin.
// Only reads what was logged; it never changes what gets logged.

/** A record the history points at: a name to show, and where to open it. */
export type Ref = { label: string; href?: string };
export type Refs = Record<string, Ref>;

/** One line in an opened history row. */
export type Change =
  | { label: string; kind: "change"; from: string; to: string }
  | { label: string; kind: "list"; added: string[]; removed: string[] }
  | { label: string; kind: "value"; value: string };

export const DASH = "—";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const EMBEDDED_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b(?!T)/g;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

const ACTIONS: Record<string, string> = {
  "password reset": "Reset password",
  "profiles insert": "Added login", "profiles update": "Changed login", "profiles delete": "Removed login",
  "application_questions insert": "Added question", "application_questions update": "Changed question", "application_questions delete": "Deleted question",
  "app_settings insert": "Set setting", "app_settings update": "Changed setting", "app_settings delete": "Cleared setting",
  "branches insert": "Added store", "branches update": "Changed store", "branches delete": "Removed store",
  "job_roles insert": "Added job role", "job_roles update": "Changed job role", "job_roles delete": "Removed job role",
  "candidates delete": "Deleted candidate",
  "candidate update": "Changed candidate", "candidate delete": "Deleted candidate", "candidate erased": "Erased candidate (privacy request)",
  "candidates exported": "Exported candidates", "old records stripped": "Cleared old personal details",
  "import staff": "Imported staff list", "firm roles update": "Changed firm's job roles",
  "approve appraisal": "Approved appraisal", "reject appraisal": "Rejected appraisal",
  "raise exit": "Raised staff exit", "confirm exit": "Confirmed last working day", "save exit interview": "Took exit interview",
  "skip exit interview": "Skipped exit interview", "relieve exit": "Relieved employee", "cancel exit": "Cancelled staff exit",
  "approve manpower request": "Approved manpower request", "close manpower request": "Closed manpower request",
  "approve temporary staff": "Approved temporary staff", "decline temporary staff": "Declined temporary staff",
  "lend staff": "Lent staff to a store", "end staff loan": "Ended staff loan",
};
const SETTINGS: Record<string, string> = {
  apply_posts: "Post list", branch_posts: "Posts open at stores", privacy_contact: "Privacy contact",
  retention_months: "Keep personal details for (months)", walkin_warn_age: "Walk-in age warning",
};

export const describeAction = (action: string) => ACTIONS[action] ?? sentence(action);

const FIELDS: Record<string, string> = {
  name: "Name", mobile: "Mobile", email: "Email", address: "Address", father_name: "Father's name", marital_status: "Marital status",
  posts: "Posts applied for", applied_locations: "Stores applied to", branch_id: "Store", assigned_hr: "HR", entry_by: "Entered by",
  received_at: "Received", source: "Came through", pipeline_status: "Stage", next_action: "Next action", next_action_at: "Next action date",
  calling_status: "Call result", calling_action: "Call follow-up", first_call_at: "First call",
  first_retry_status: "1st retry result", first_retry_at: "1st retry", second_retry_status: "2nd retry result", second_retry_at: "2nd retry",
  third_retry_status: "3rd retry result", third_retry_at: "3rd retry", interview_at: "Interview", interview_attendance: "Came for interview",
  interview_status: "Interview result", not_attended_reason: "Why not attended", reschedule_at: "Rescheduled interview",
  reschedule_attendance: "Came for rescheduled interview", reminder_status: "Reminder result", reminder_at: "Reminder",
  designation: "Designation", basic_salary: "Basic salary", allowances: "Allowances", expected_joining_date: "Expected joining",
  joining_status: "Joining status", not_joined_reason: "Why not joined", revised_joining_date: "Revised joining",
  revised_joining_status: "Revised joining status", actual_joining_date: "Joined on", employment_status: "Employment status",
  left_type: "How they left", relieving_date: "Relieving date", rejection_reason: "Rejection reason", interview_needed: "Interview needed",
  source_channel: "Heard about us from", referred_by: "Referred by", talent_pool: "In talent pool", talent_tags: "Talent tags",
  offer_response: "Offer answer", offer_responded_at: "Offer answered", offer_decline_reason: "Why offer declined",
  confirmation_date: "Confirmation date", confirmation_approved_by: "Confirmation approved by", confirmation_approved_at: "Confirmation approved",
  last_sms_key: "Last SMS", last_sms_at: "Last SMS sent", employee_code: "Employee code", shift_time: "Shift",
  store_details_at: "Store details added", payroll_completed_at: "Payroll done", payroll_completed_by: "Payroll done by",
  reapply_review: "Re-applied, needs review", reapply_at: "Re-applied", proposed_basic: "Proposed basic", proposed_allowances: "Proposed allowances",
  salary_status: "Salary approval", salary_approved_by: "Salary approved by", salary_approved_at: "Salary approved",
  aadhaar_check: "Aadhaar check", access_token: "Candidate link", token_expires_at: "Candidate link valid till",
  application_folder: "Application files", consent_version: "Privacy notice version", consented_at: "Agreed to privacy notice",
  // logins, stores, questions, roles
  username: "Username", full_name: "Full name", role: "Role", photo_path: "Photo", town: "Town", business_type: "Business",
  hr_username: "Store HR", division: "Firm", street_address: "Street", postal_code: "PIN code", label: "Question", type: "Answer type",
  required: "Must answer", options: "Choices", sort_order: "Order", deleted_at: "Deleted", min_age: "Minimum age", key: "Setting",
  summary: "Summary", duties: "Duties", requirements: "Requirements", shift: "Shift", benefits: "Benefits", sort: "Order",
  // log_change details
  rows: "Rows", added: "Added", problems: "Rows with problems", count: "People", months: "Older than (months)", roles: "Roles",
  basic: "Basic", from: "From", effective_from: "From", note: "Note", opened_post: "Post opened", people: "People", last_day: "Last day",
  hired: "Hired", employment_id: "Person", post: "Post", method: "Checked by", dob: "Date of birth", gender: "Gender", last4: "Last 4 digits",
  by: "By", at: "On",
};
/** Raw columns that mean nothing to HR; a change shows only that it happened. */
const SECRET = new Set(["access_token", "application_folder", "photo_path"]);
const HIDDEN = new Set(["id", "created_at", "updated_at", "form_data"]);
const MONEY = new Set(["basic_salary", "allowances", "proposed_basic", "proposed_allowances", "basic", "salary_min", "salary_max",
  "current_basic", "current_allowances"]);
/** Username columns: shown as typed, never re-cased. */
const PEOPLE = new Set(["assigned_hr", "entry_by", "hr_username", "username", "confirmation_approved_by", "payroll_completed_by",
  "salary_approved_by", "requested_by", "decided_by", "by", "referred_by"]);
const WORDS: Record<string, string> = { walkin: "Walk-in", online: "Online", superadmin: "Super admin", hr: "HR", branch: "Store login",
  "secure qr": "Aadhaar Secure QR", "e-kyc": "Aadhaar e-KYC file", "in person": "Seen in person" };

export const fieldLabel = (key: string, refs: Refs = {}) => refs[key]?.label ?? FIELDS[key] ?? sentence(key);

function sentence(s: string) {
  const t = s.replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : s;
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
const hourMinute = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "2026-11-09" -> "9 Nov 2026" (IST). */
export function formatDay(value: string) {
  const d = DATE.test(value) ? new Date(`${value}T00:00:00+05:30`) : new Date(value);
  return Number.isNaN(d.getTime()) ? value : dayFmt.format(d);
}

/** Timestamp -> "9 Nov 2026", plus the time when it is not midnight in IST. */
export function formatStamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = dayFmt.format(d);
  return hourMinute.format(d) === "00:00" ? day : `${day}, ${timeFmt.format(d).toLowerCase()}`;
}

const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

/** One logged value in plain words. */
export function formatValue(key: string, v: unknown, refs: Refs = {}): string {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return DASH;
  if (SECRET.has(key)) return "(set)";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return MONEY.has(key) ? rupees(v) : String(v);
  if (Array.isArray(v)) return v.map((x) => formatValue(key, x, refs)).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (isUuid(o.employment_id)) return `${formatValue("employment_id", o.employment_id, refs)}${o.post ? ` as ${o.post}` : ""}`;
    return Object.entries(o).filter(([k]) => !HIDDEN.has(k))
      .map(([k, x]) => `${fieldLabel(k, refs)}: ${formatValue(k, x, refs)}`).join("; ") || DASH;
  }
  const s = String(v);
  if (UUID.test(s)) return refs[s]?.label ?? "(no longer on file)";
  if (DATE.test(s)) return formatDay(s);
  if (STAMP.test(s)) return formatStamp(s);
  if (MONEY.has(key) && /^\d+(\.\d+)?$/.test(s)) return rupees(Number(s));
  if (WORDS[s]) return WORDS[s];
  if (!PEOPLE.has(key) && /^[a-z]+(_[a-z]+)+$/.test(s)) return sentence(s);
  // Dates written into text, e.g. "Check revised joining (2026-11-09)".
  return s.replace(EMBEDDED_DATE, (d) => formatDay(d));
}

const isDiff = (v: unknown): v is { from: unknown; to: unknown } =>
  !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 2 && "from" in v && "to" in v;
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function diffLines(label: string, key: string, from: unknown, to: unknown, refs: Refs, out: Change[]) {
  const fromList = Array.isArray(from) || from == null ? (from as unknown[] | null) ?? [] : null;
  const toList = Array.isArray(to) || to == null ? (to as unknown[] | null) ?? [] : null;
  if (fromList && toList && (Array.isArray(from) || Array.isArray(to))) {
    const shown = (x: unknown) => formatValue(key, x, refs);
    const a = fromList.map(shown), b = toList.map(shown);
    const added = b.filter((x) => !a.includes(x)), removed = a.filter((x) => !b.includes(x));
    if (added.length || removed.length) out.push({ label, kind: "list", added, removed });
    else out.push({ label, kind: "change", from: a.join(", ") || DASH, to: b.join(", ") || DASH }); // same items, new order
    return;
  }
  if (isPlainObject(from) && isPlainObject(to)) {
    for (const k of [...new Set([...Object.keys(from), ...Object.keys(to)])]) {
      if (HIDDEN.has(k) || same(from[k], to[k])) continue;
      const sub = fieldLabel(k, refs);
      diffLines(label === "Value" ? sub : `${label} › ${sub}`, k, from[k], to[k], refs, out);
    }
    return;
  }
  if (SECRET.has(key)) { out.push({ label, kind: "value", value: "Changed" }); return; }
  out.push({ label, kind: "change", from: formatValue(key, from, refs), to: formatValue(key, to, refs) });
}

/** The lines shown when a history row is opened. */
export function describeChanges(action: string, target: string | null, detail: Record<string, unknown> | null, refs: Refs = {}): Change[] {
  if (!detail) return [];
  const out: Change[] = [];
  const setting = action.startsWith("app_settings") ? SETTINGS[target ?? ""] : undefined;
  for (const [k, v] of Object.entries(detail)) {
    if (HIDDEN.has(k)) continue;
    // The candidate's name is logged with every change so the row can be named; it is not itself a change.
    if (k === "name" && action === "candidate update" && !isDiff(v)) continue;
    if (k === "key" && setting) continue;
    const label = k === "value" && setting ? setting : fieldLabel(k, refs);
    // A store-by-store setting is already named in the "On" column, so its lines are just the store names.
    if (isDiff(v)) diffLines(setting && isPlainObject(v.from) && isPlainObject(v.to) ? "Value" : label, k, v.from, v.to, refs, out);
    else out.push({ label, kind: "value", value: formatValue(k, v, refs) });
  }
  return out;
}

/** The "On" column: a name instead of a code, with a link where one exists. */
export function describeTarget(action: string, target: string | null, detail: Record<string, unknown> | null, refs: Refs = {}): Ref {
  if (!target) return { label: DASH };
  if (action.startsWith("app_settings")) return { label: SETTINGS[target] ?? sentence(target) };
  if (refs[target]) return refs[target];
  if (isUuid(target)) {
    const name = typeof detail?.name === "string" ? detail.name : null;
    if (action.startsWith("candidate")) return { label: name ? `${name} (deleted)` : "A candidate no longer on file" };
    return { label: "(no longer on file)" };
  }
  return { label: target };
}

/** Which kind of record each action's target points at, so the page can look the names up. */
export function targetTable(action: string): "candidates" | "manpower_requests" | "staff_loans" | "appraisals" | "employments" | null {
  if (action.startsWith("candidate ")) return "candidates";
  if (/ exit( interview)?$/.test(action)) return "employments";
  if (action === "end staff loan") return "staff_loans";
  if (action.endsWith(" appraisal")) return "appraisals";
  if (/manpower request|temporary staff|lend staff/.test(action)) return "manpower_requests";
  return null;
}

/** Every employment id inside lend-staff details, to look up people's names. */
export function employmentIds(detail: Record<string, unknown> | null): string[] {
  const people = detail?.people;
  return Array.isArray(people) ? people.map((p) => (p as { employment_id?: unknown })?.employment_id).filter(isUuid) : [];
}

/** "3 Nov 2026, 5:57 pm" for the When column. */
export const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${dayFmt.format(d)}, ${timeFmt.format(d).toLowerCase()}`;
};
