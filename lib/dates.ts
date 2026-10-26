// All business dates are Indian Standard Time, as in the original app.
export const IST_OFFSET = "+05:30";

/** "2026-10-24T10:30" from a datetime-local input -> ISO timestamp in IST. */
export function localInputToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (/[zZ]|[+-]\d\d:\d\d$/.test(v)) return new Date(v).toISOString();
  const withSeconds = v.length === 16 ? `${v}:00` : v;
  return new Date(`${withSeconds}${IST_OFFSET}`).toISOString();
}

/** "2026-10-24" -> midnight IST ISO timestamp. */
export function dateToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  return localInputToIso(`${value.trim().slice(0, 10)}T00:00`);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Today's date in IST as YYYY-MM-DD. */
export function todayIst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

export function tomorrowIstIso(now: Date = new Date()): string {
  const t = new Date(now.getTime() + 24 * 3600 * 1000);
  return dateToIso(todayIst(t))!;
}

/** ISO timestamp -> YYYY-MM-DD in IST. */
export function isoToIstDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return todayIst(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00${IST_OFFSET}`) : new Date(iso);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

/** ISO -> value for a datetime-local input, in IST. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return r;
}

/**
 * Probation rule from the original app: 6 months. Joining on the 1st ends the day
 * before the same date 6 months later; otherwise it runs to the end of the month
 * 6 months after joining.
 */
export function probationEnd(joiningDate: string): string {
  const [y, m, day] = joiningDate.slice(0, 10).split("-").map(Number);
  const doj = new Date(Date.UTC(y, m - 1, day));
  let end: Date;
  if (day === 1) {
    end = addMonths(doj, 6);
    end.setUTCDate(end.getUTCDate() - 1);
  } else {
    const six = addMonths(doj, 6);
    end = new Date(Date.UTC(six.getUTCFullYear(), six.getUTCMonth() + 1, 0));
  }
  return end.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Short, human date for lists: "Today, 4:30 pm", "Tomorrow", "Mon, 3 Nov", "2 days overdue".
 *  `dateOnly` drops the time (joining dates carry a meaningless midnight time). */
export function friendlyWhen(iso: string | null | undefined, opts: { dateOnly?: boolean; now?: Date } = {}): { text: string; overdue: boolean; soon: boolean } {
  if (!iso) return { text: "-", overdue: false, soon: false };
  const now = opts.now ?? new Date();
  const day = isoToIstDate(iso)!;
  const today = todayIst(now);
  const days = Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000);
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).toLowerCase();
  const withTime = (s: string) => (opts.dateOnly ? s : `${s}, ${time}`);
  if (days < 0) return { text: days === -1 ? "Yesterday (overdue)" : `${-days} days overdue`, overdue: true, soon: false };
  if (days === 0) return { text: withTime("Today"), overdue: false, soon: true };
  if (days === 1) return { text: withTime("Tomorrow"), overdue: false, soon: true };
  const label = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
  return { text: withTime(label), overdue: false, soon: false };
}

/** "3 h ago", "2 d ago" for received times. */
export function ago(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "-";
  const mins = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 60 ? `${d} d ago` : formatDate(iso);
}
