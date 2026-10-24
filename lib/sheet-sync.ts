/**
 * Reads the Google Sheet "Job Application All Locations" (fed by the Google Form).
 * - importAll(): one-time migration of Master Sheet, Walkin_Sheet and Documents_Sheet, including pipeline history.
 * - syncNewApplications(): scheduled job, adds new form responses and merges repeat applications.
 */
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dateToIso, localInputToIso } from "./dates";
import type { Branch } from "./types";

type Row = Record<string, string>;

export async function readSheetTabs(tabs: string[]): Promise<Record<string, Row[]>> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const creds = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/drive.metadata.readonly"] });
  const drive = google.drive({ version: "v3", auth });
  const name = process.env.GOOGLE_SHEET_NAME ?? "Job Application All Locations";
  const id = process.env.GOOGLE_SHEET_ID ?? (await drive.files.list({
    q: `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet'`, fields: "files(id)",
  })).data.files?.[0]?.id;
  if (!id) throw new Error(`Spreadsheet "${name}" not found or not shared with the service account`);

  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets.properties.title" });
  const present = new Set(meta.data.sheets?.map((s) => s.properties?.title));
  const out: Record<string, Row[]> = {};
  for (const tab of tabs) {
    if (!present.has(tab)) { out[tab] = []; continue; }
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `'${tab}'`, valueRenderOption: "FORMATTED_VALUE" });
    const [header = [], ...rows] = (res.data.values ?? []) as string[][];
    const h = header.map((x) => String(x).trim());
    out[tab] = rows.map((r) => Object.fromEntries(h.map((k, i) => [k, String(r[i] ?? "").trim()])));
  }
  return out;
}

const pick = (r: Row, ...keys: string[]) => { for (const k of keys) if (r[k]) return r[k]; return ""; };
const clean = (loc: string) => loc.replace(/\s*\([^)]*\)/g, "").trim();
export const normMobile = (m: string) => m.replace(/\D/g, "").slice(-10);

/** "24/10/2026 14:05:00", "24/10/2026", "2026-10-24", "2026-10-24T10:30" -> ISO (IST) */
export function parseSheetDate(v: string): string | null {
  if (!v) return null;
  const s = v.trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/);
  if (m) {
    let hh = Number(m[4] ?? 0);
    if (m[7]) hh = (hh % 12) + (/p/i.test(m[7]) ? 12 : 0);
    const p = (n: number | string) => String(n).padStart(2, "0");
    return localInputToIso(`${m[3]}-${p(m[2])}-${p(m[1])}T${p(hh)}:${m[5] ?? "00"}`);
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) return m[4] ? localInputToIso(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`) : dateToIso(`${m[1]}-${m[2]}-${m[3]}`);
  return null;
}
const parseDay = (v: string) => parseSheetDate(v)?.slice(0, 10) ?? null;
const istDay = (v: string) => { const iso = parseSheetDate(v); return iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso)) : null; };

const APP_MANAGED = new Set([
  "Pipeline Status", "Final Status", "Next Action", "Action", "Action / Schedule Details", "HR Name", "Branch Allocated",
  "Calling Status", "Calling Action", "Follow-up Date & Time", "First Retry Status", "First Retry Date Time", "Second Retry Status",
  "Second Retry Date Time", "Third Retry Status", "Third Retry Date Time", "Interview Date & Time", "Interview Attendance",
  "Interview status", "Not Attended Reason", "Screening Rejection Reason", "Rejected Reason", "Reschedule Date Time",
  "Reschedule Interview Attendance", "Reminder Status", "Reminder Date", "Basic Salary", "Allowances", "Designation",
  "Expected Joining Date", "Joining Status", "Not Joined Reason", "Revised Joining Date", "Revised Joining Status",
  "Actual Joining Date", "Remarks", "Salary", "S.No",
]);

function branchMatcher(branches: Branch[]) {
  return (loc: string): Branch | undefined => {
    const l = clean(loc).toLowerCase();
    if (!l) return undefined;
    return branches.find((b) => b.name.toLowerCase() === l) ?? branches.find((b) => l.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(l));
  };
}

function hrFor(loc: string, matchBranch: ReturnType<typeof branchMatcher>): string {
  const b = matchBranch(loc);
  if (b) return b.hr_username;
  const l = loc.toLowerCase();
  if (/madurai|virudhunagar|srivilliputhur|sivakasi|caratlane|mukesh honda/.test(l)) return "rishi";
  if (/tenkasi|tirunelveli|akshaya velli|tvs|rajapalayam/.test(l)) return "aarthi";
  return "lithiga";
}

/** Sheet row -> candidate columns. withPipeline=false keeps only application data (for the scheduled sync). */
function toCandidate(r: Row, source: "online" | "walkin", matchBranch: ReturnType<typeof branchMatcher>, withPipeline: boolean) {
  const loc = clean(pick(r, "Applying Location & Branch", "Location & Branch", "Applying Location", "Branch"));
  const allocated = matchBranch(pick(r, "Branch Allocated"));
  const form_data = Object.fromEntries(Object.entries(r).filter(([k, v]) => v && !APP_MANAGED.has(k)));
  const base = {
    source,
    name: pick(r, "Name Of The Applicant", "Applicant Name", "Name"),
    mobile: normMobile(pick(r, "Mobile Number", "Mobile No", "Mobile")),
    marital_status: pick(r, "Marital Status") || null,
    father_name: pick(r, "Father's / Husband's Name", "Father's Name", "Father Name") || null,
    email: pick(r, "Mail Id", "Email", "Email Address") || null,
    address: pick(r, "Permanent Address", "Address") || null,
    posts: [pick(r, "Post Applying For", "Applying For", "Post")].filter(Boolean),
    applied_locations: [matchBranch(loc)?.name ?? loc].filter(Boolean),
    assigned_hr: (pick(r, "HR Name", "Allocated HR") || hrFor(allocated?.name ?? loc, matchBranch)).toLowerCase().replace("lithika", "lithiga"),
    entry_by: pick(r, "Entry By") || null,
    received_at: parseSheetDate(pick(r, "Timestamp", "Date", "RECEIVED DATE")) ?? new Date().toISOString(),
    form_data,
  };
  if (!withPipeline) return base;

  const status = pick(r, "Pipeline Status", "Final Status") || (source === "walkin" ? (/^yes$/i.test(pick(r, "Interview Needed")) ? "Interview Scheduled" : "Expected Joining") : "Follow-up Not Started");
  const interviewAt = parseSheetDate(pick(r, "Interview Date & Time"));
  const expected = parseDay(pick(r, "Expected Joining Date"));
  const revised = parseDay(pick(r, "Revised Joining Date"));
  const nextAt = status === "Revised Joining" ? (revised ? dateToIso(revised) : null)
    : status === "Expected Joining" || status === "Selected / Offer Generated" ? (expected ? dateToIso(expected) : null)
    : status.startsWith("Interview") ? interviewAt : null;
  return {
    ...base,
    branch_id: allocated?.id ?? null,
    pipeline_status: status,
    next_action: pick(r, "Next Action", "Action") || null,
    next_action_at: nextAt,
    calling_status: pick(r, "Calling Status") || null,
    calling_action: pick(r, "Calling Action") || null,
    first_call_at: parseSheetDate(pick(r, "Follow-up Date & Time")),
    first_retry_status: pick(r, "First Retry Status") || null,
    first_retry_at: parseSheetDate(pick(r, "First Retry Date Time")),
    second_retry_status: pick(r, "Second Retry Status") || null,
    second_retry_at: parseSheetDate(pick(r, "Second Retry Date Time")),
    third_retry_status: pick(r, "Third Retry Status") || null,
    third_retry_at: parseSheetDate(pick(r, "Third Retry Date Time")),
    interview_at: interviewAt,
    interview_attendance: pick(r, "Interview Attendance") || null,
    interview_status: pick(r, "Interview status", "Interview Status") || null,
    not_attended_reason: pick(r, "Not Attended Reason") || null,
    reschedule_at: parseSheetDate(pick(r, "Reschedule Date Time")),
    reschedule_attendance: pick(r, "Reschedule Interview Attendance") || null,
    reminder_status: pick(r, "Reminder Status") || null,
    designation: pick(r, "Designation") || null,
    basic_salary: Number(pick(r, "Basic Salary").replace(/[^\d.]/g, "")) || 0,
    allowances: Number(pick(r, "Allowances").replace(/[^\d.]/g, "")) || 0,
    expected_joining_date: expected,
    joining_status: pick(r, "Joining Status") || null,
    not_joined_reason: pick(r, "Not Joined Reason") || null,
    revised_joining_date: revised,
    revised_joining_status: pick(r, "Revised Joining Status") || null,
    actual_joining_date: istDay(pick(r, "Actual Joining Date")),
    rejection_reason: pick(r, "Screening Rejection Reason", "Rejected Reason") || null,
    interview_needed: source === "walkin" ? /^yes$/i.test(pick(r, "Interview Needed")) : null,
    employment_status: status === "Joined" ? "Working" : status.startsWith("Left") ? "Left" : null,
    _remarks: pick(r, "Remarks"),
  };
}

type CandRow = ReturnType<typeof toCandidate> & { _remarks?: string };

function mergeByMobile(rows: CandRow[]): CandRow[] {
  const by = new Map<string, CandRow>();
  for (const r of rows) {
    if (r.mobile.length !== 10 || !r.name) continue;
    const ex = by.get(r.mobile);
    if (!ex) { by.set(r.mobile, r); continue; }
    ex.posts = [...new Set([...ex.posts, ...r.posts])];
    ex.applied_locations = [...new Set([...ex.applied_locations, ...r.applied_locations])];
  }
  return [...by.values()];
}

async function loadBranches(db: SupabaseClient) {
  const { data } = await db.from("branches").select("*");
  return branchMatcher((data ?? []) as Branch[]);
}

/** Scheduled sync: new Google Form responses become new candidates; repeat applications add posts/locations. */
export async function syncNewApplications(db: SupabaseClient) {
  const tabs = await readSheetTabs(["Master Sheet"]);
  const match = await loadBranches(db);
  const incoming = mergeByMobile(tabs["Master Sheet"].map((r) => toCandidate(r, "online", match, false)));
  const { data: existing } = await db.from("candidates").select("id, mobile, posts, applied_locations");
  const known = new Map((existing ?? []).map((c) => [c.mobile as string, c]));

  const fresh = incoming.filter((c) => !known.has(c.mobile)).map((c) => ({ ...c, next_action: "Follow-up start immediately", next_action_at: c.received_at }));
  let merged = 0;
  for (const c of incoming) {
    const k = known.get(c.mobile);
    if (!k) continue;
    const posts = [...new Set([...(k.posts as string[]), ...c.posts])];
    const locs = [...new Set([...(k.applied_locations as string[]), ...c.applied_locations])];
    if (posts.length !== (k.posts as string[]).length || locs.length !== (k.applied_locations as string[]).length) {
      await db.from("candidates").update({ posts, applied_locations: locs }).eq("id", k.id);
      merged++;
    }
  }
  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await db.from("candidates").insert(fresh.slice(i, i + 500));
    if (error) throw error;
  }
  if (fresh.length) {
    const perHr = new Map<string, number>();
    fresh.forEach((c) => perHr.set(c.assigned_hr, (perHr.get(c.assigned_hr) ?? 0) + 1));
    await db.from("notifications").insert([...perHr].map(([hr, n]) => ({ sender: "HR Portal", recipient: hr, message: `${n} new online application${n > 1 ? "s" : ""} received.` })));
  }
  return { added: fresh.length, merged };
}

/** One-time migration of everything in the Sheet. Safe to re-run: existing mobiles are updated, not duplicated. */
export async function importAll(db: SupabaseClient, log: (s: string) => void = console.log) {
  const tabs = await readSheetTabs(["Master Sheet", "Walkin_Sheet", "Documents_Sheet"]);
  const match = await loadBranches(db);
  const online = tabs["Master Sheet"].map((r) => toCandidate(r, "online", match, true) as CandRow);
  const walkin = tabs["Walkin_Sheet"].map((r) => toCandidate(r, "walkin", match, true) as CandRow);
  // A walk-in record wins over an online one for the same mobile, as in the original dashboard.
  const all = mergeByMobile([...walkin, ...online]);
  log(`Sheet: ${online.length} online rows, ${walkin.length} walk-in rows -> ${all.length} unique candidates`);

  for (let i = 0; i < all.length; i += 300) {
    const chunk = all.slice(i, i + 300).map(({ _remarks, ...c }) => { void _remarks; return c; });
    const { error } = await db.from("candidates").upsert(chunk, { onConflict: "mobile" });
    if (error) throw error;
  }
  const { data: ids } = await db.from("candidates").select("id, mobile");
  const idBy = new Map((ids ?? []).map((c) => [c.mobile as string, c.id as string]));

  const events = all.filter((c) => c._remarks).map((c) => ({ candidate_id: idBy.get(c.mobile), actor: "import", stage: "import", remark: c._remarks }));
  for (let i = 0; i < events.length; i += 500) await db.from("candidate_events").insert(events.slice(i, i + 500));

  let docs = 0;
  for (const r of tabs["Documents_Sheet"]) {
    const id = idBy.get(normMobile(pick(r, "Mobile Number")));
    if (!id) continue;
    const fileCols: Record<string, string> = {
      aadhar: "Aadhar", school_certificate: "School / College Certificate", passport_photo: "Passport Size Photo", bank_passbook: "Bank Pass Book",
      pan_card: "PAN Card", driving_license: "Driving License", father_aadhar: "Father Aadhar Card", father_photo: "Father Photo",
      mother_aadhar: "Mother Aadhar Card", mother_photo: "Mother Photo", spouse_aadhar: "Spouse Aadhar Card", spouse_photo: "Spouse Photo",
      kid_1_aadhar: "Kid 1 Aadhar", kid_1_photo: "Kid 1 Photo", kid_2_aadhar: "Kid 2 Aadhar", kid_2_photo: "Kid 2 Photo",
      kid_3_aadhar: "Kid 3 Aadhar", kid_3_photo: "Kid 3 Photo", kid_4_aadhar: "Kid 4 Aadhar", kid_4_photo: "Kid 4 Photo", kid_5_aadhar: "Kid 5 Aadhar", kid_5_photo: "Kid 5 Photo",
    };
    const files = Object.fromEntries(Object.entries(fileCols).map(([k, col]) => [k, r[col]]).filter(([, v]) => v && /^https?:/.test(v)));
    const statusRaw = pick(r, "Status");
    const status = /complet/i.test(statusRaw) ? "completed" : /pending/i.test(statusRaw) ? "pending" : "submitted";
    const details = {
      father_name: pick(r, "Father's / Husband's Name"), marital_status: pick(r, "Marital Status"), wedding_date: pick(r, "Wedding Date"),
      email: pick(r, "Mail Id"), blood_group: pick(r, "Blood Group"), emergency_name: pick(r, "Emergency Contact Person Name"),
      emergency_relationship: pick(r, "Emergency Contact Person Relationship"), emergency_mobile: pick(r, "Emergency Contact Person Mobile Number"),
      esi_number: pick(r, "ESI Number"), uan_number: pick(r, "UAN Number"), mother_name: pick(r, "Mother Name"), spouse_name: pick(r, "Spouse Name"),
      kids_count: pick(r, "Kids Count"),
    };
    await db.from("onboarding_submissions").upsert({
      candidate_id: id, status, files, details: Object.fromEntries(Object.entries(details).filter(([, v]) => v && v !== "N/A")),
      employee_code: pick(r, "Employee Code") || null, shift_time: pick(r, "Shift Time") || null,
      submitted_at: parseSheetDate(pick(r, "Timestamp")) ?? new Date().toISOString(),
    }, { onConflict: "candidate_id" });
    docs++;
  }
  log(`Imported ${all.length} candidates, ${events.length} remark histories, ${docs} onboarding submissions`);
}
