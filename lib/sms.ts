/**
 * "Today's SMS List": candidates who need a message today, and the ready-made Tamil + English text for each.
 * Nothing is sent automatically: HR taps WhatsApp or SMS, which opens the phone's app with the text filled in.
 * Once sent from the list, the item's key is saved on the candidate (last_sms_key) and the row drops off.
 */
import type { Candidate } from "./types";
import type { Categorized } from "./categorize";
import { addDays, formatDate, isoToIstDate, todayIst } from "./dates";

export type SmsKind = "interview_scheduled" | "interview_reminder" | "interview_missed" | "not_contactable" | "joining_reminder" | "not_joined";

export const SMS_TITLES: Record<SmsKind, string> = {
  interview_scheduled: "Interview scheduled",
  interview_reminder: "Interview tomorrow (reminder)",
  interview_missed: "Interview not attended (unreachable)",
  not_contactable: "Not contactable: ask to call back",
  joining_reminder: "Joining tomorrow (reminder)",
  not_joined: "Not joined (no response)",
};

export interface SmsItem { kind: SmsKind; key: string; done: string[] }

const UNREACHABLE = ["Follow-up Unreachable", "First Retry Unreachable", "Second Retry Unreachable", "Third Retry Unreachable"];
const INTERVIEW = ["Interview Scheduled", "Interview Rescheduled"];
const JOINING = ["Expected Joining", "Selected / Offer Generated", "Revised Joining"];

/** Same date the offer letter uses. */
const joiningDate = (c: Candidate) => c.revised_joining_date ?? c.expected_joining_date ?? null;

/** The message this candidate needs today, if any. `done` lists keys that also count as already sent. */
export function smsItem(c: Candidate, cat: Categorized, now: Date = new Date()): SmsItem | null {
  if (!cat.active) return null;
  const today = todayIst(now);
  const tomorrow = todayIst(new Date(now.getTime() + 86400000));
  const s = c.pipeline_status;
  let item: SmsItem | null = null;

  if (INTERVIEW.includes(s) && c.interview_at && Date.parse(c.interview_at) > now.getTime()) {
    const reminder = `interview_reminder:${c.interview_at}`;
    item = isoToIstDate(c.interview_at) === tomorrow
      ? { kind: "interview_reminder", key: reminder, done: [] }
      : { kind: "interview_scheduled", key: `interview_scheduled:${c.interview_at}`, done: [reminder] };
  } else if (s === "Interview Scheduled - Unreachable") {
    item = { kind: "interview_missed", key: `interview_missed:${c.interview_at ?? ""}`, done: [] };
  } else if (UNREACHABLE.includes(s)) {
    item = { kind: "not_contactable", key: `not_contactable:${s}`, done: [] };
  } else if (JOINING.includes(s)) {
    const d = joiningDate(c);
    if (d === tomorrow) item = { kind: "joining_reminder", key: `joining_reminder:${d}`, done: [] };
    else if (d && d < today) item = { kind: "not_joined", key: `not_joined:${d}`, done: [] };
  }
  if (!item || c.last_sms_key === item.key || (c.last_sms_key && item.done.includes(c.last_sms_key))) return null;
  return item;
}

export interface SmsContext {
  name: string;
  post: string;
  store: string;
  address: string;
  when: string;            // interview date & time, or joining date
  hrName: string;
  hrMobile: string | null; // the allocated HR's own number, from their profile
  validity?: string;       // offer letter validity date
}

const callLine = (c: SmsContext) => c.hrMobile
  ? { en: `Please call ${c.hrName} (HR) on ${c.hrMobile}.`, ta: `${c.hrName} (HR) அவர்களை ${c.hrMobile} என்ற எண்ணில் அழைக்கவும்.` }
  : { en: "Please call us back on this number.", ta: "இந்த எண்ணுக்கு திரும்ப அழைக்கவும்." };

export function smsText(kind: SmsKind, c: SmsContext): string {
  const call = callLine(c);
  const sign = `\n- HR, Balasanka Group`;
  switch (kind) {
    case "interview_scheduled":
      return `வணக்கம் ${c.name}, ${c.post} பதவிக்கான நேர்காணல்: ${c.when}, இடம்: ${c.store}, ${c.address}. ஆதார் மற்றும் சான்றிதழ்களைக் கொண்டு வரவும்.\n\nDear ${c.name}, your interview for ${c.post} is on ${c.when} at ${c.store}, ${c.address}. Please bring your Aadhaar and certificates.${sign}`;
    case "interview_reminder":
      return `நினைவூட்டல்: ${c.name}, உங்கள் நேர்காணல் நாளை ${c.when}, ${c.store}-இல். வர இயலாவிட்டால் தெரிவிக்கவும்.\n\nReminder: ${c.name}, your interview is tomorrow, ${c.when}, at ${c.store}. If you can't come, please let us know.${sign}`;
    case "interview_missed":
      return `வணக்கம் ${c.name}, ${c.when} அன்று நேர்காணலுக்கு நீங்கள் வரவில்லை, உங்களைத் தொடர்பு கொள்ளவும் முடியவில்லை. புதிய நேரம் பெற அல்லது உங்கள் நிலையைத் தெரிவிக்க ${call.ta}\n\nDear ${c.name}, you missed your interview on ${c.when} and we could not reach you. To reschedule or update us, ${call.en.charAt(0).toLowerCase()}${call.en.slice(1)}${sign}`;
    case "not_contactable":
      return `வணக்கம் ${c.name}, ${c.store} - ${c.post} விண்ணப்பம் தொடர்பாக உங்களை அழைக்க முயன்றோம். ${call.ta}\n\nDear ${c.name}, we tried to reach you about your application for ${c.post} at ${c.store}. ${call.en}${sign}`;
    case "joining_reminder":
      return `வணக்கம் ${c.name}, நாளை ${c.when} அன்று ${c.store}-இல் பணியில் சேர உங்களை எதிர்பார்க்கிறோம். ஆதார், புகைப்படம், வங்கி விவரங்களைக் கொண்டு வரவும்.\n\nDear ${c.name}, we look forward to you joining ${c.store} tomorrow, ${c.when}. Please bring your Aadhaar, a photo and bank details.${sign}`;
    case "not_joined":
      return `வணக்கம் ${c.name}, ${c.when} அன்று நீங்கள் பணியில் சேரவில்லை. உங்கள் பணி வாய்ப்பு ${c.validity ?? "-"} வரை மட்டுமே செல்லுபடியாகும். ${call.ta}\n\nDear ${c.name}, you did not join on ${c.when}. Your offer is valid only until ${c.validity ?? "-"}. ${call.en}${sign}`;
  }
}

/** Offer validity, as printed on the offer letter: joining date + 3 days. */
export const offerValidity = (joining: string) => formatDate(addDays(joining, 3));

export { joiningDate };
export const smsLink = (mobile: string, body: string) => `sms:+91${mobile}?body=${encodeURIComponent(body)}`;
