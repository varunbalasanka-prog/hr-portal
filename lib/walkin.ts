import { localInputToIso, todayIst } from "./dates";

/** Indian mobile from whatever was typed: spaces, dashes, +91 or a leading 0 are fine; returns null unless it's 10 digits starting 6-9. */
export function normalizeMobile(raw: string): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** "15,000", "₹ 15000", "15000.00" -> 15000. Empty -> 0. Anything else -> null (so it's never silently dropped). */
export function parseRupees(raw: string | undefined): number | null {
  const v = (raw ?? "").replace(/[₹,\s]|rs\.?/gi, "");
  if (!v) return 0;
  return /^\d+(\.\d{1,2})?$/.test(v) ? Number(v) : null;
}

const addDays = (ymd: string, days: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

export interface WalkinFields {
  name: string;
  mobile: string;
  post: string;
  interviewNeeded: "Yes" | "No";
  interviewAt?: string;
  basicSalary?: string;
  allowances?: string;
  expectedJoiningDate?: string;
}

export type WalkinCheck =
  | { error: string }
  | { error?: undefined; name: string; mobile: string; post: string; interviewAt: string | null; joining: string | null; basic: number; allowances: number };

/** Every rule the walk-in form needs, in one place so the browser and the server say the same thing. */
export function checkWalkin(f: WalkinFields, now: Date = new Date()): WalkinCheck {
  const name = f.name.trim().replace(/\s+/g, " ");
  if (name.replace(/[^\p{L}]/gu, "").length < 2) return { error: "Enter the applicant's name." };
  const mobile = normalizeMobile(f.mobile);
  if (!mobile) return { error: "Enter a valid 10-digit mobile number (starting with 6, 7, 8 or 9)." };
  const post = f.post.trim().replace(/\s+/g, " ");
  if (!post) return { error: "Enter the post they are applying for." };

  const today = todayIst(now);
  if (f.interviewNeeded === "Yes") {
    const at = localInputToIso(f.interviewAt);
    if (!at) return { error: "Enter the interview date and time." };
    const day = todayIst(new Date(at));
    if (day < today) return { error: "The interview date is in the past. Check the date." };
    if (day > addDays(today, 60)) return { error: "The interview date is more than 2 months away. Check the date." };
    return { name, mobile, post, interviewAt: at, joining: null, basic: 0, allowances: 0 };
  }

  const joining = (f.expectedJoiningDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(joining)) return { error: "Enter the expected joining date." };
  if (joining < today) return { error: "The joining date is in the past. Check the date." };
  if (joining > addDays(today, 120)) return { error: "The joining date is more than 4 months away. Check the date." };
  const basic = parseRupees(f.basicSalary);
  const allowances = parseRupees(f.allowances);
  if (basic === null) return { error: "Basic salary must be a number, like 15000." };
  if (allowances === null) return { error: "Allowances must be a number, like 2000." };
  return { name, mobile, post, interviewAt: null, joining, basic, allowances };
}
