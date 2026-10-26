import { addDays, isoToIstDate, probationEnd, todayIst } from "./dates";
import type { Candidate } from "./types";

/** HR gets the approval alert a week before the confirmation date (the 1st after the 6-month probation), e.g. 25/08 for 01/09. */
export const ALERT_DAYS_BEFORE = 7;
/** Probations that ended longer ago than this get no alert: those staff were confirmed on paper. Keep in step with the cron. */
export const BACKLOG_DAYS = 90;

type C = Pick<Candidate, "pipeline_status" | "actual_joining_date" | "employment_status" | "confirmation_date"> & { confirmation_approved_at?: string | null };

const working = (c: C) => c.pipeline_status === "Joined" && !!c.actual_joining_date && c.employment_status !== "Left";

/** The date the employee is confirmed from: the day after probation ends (always a 1st), unless HR set another. */
export function confirmationDate(c: C): string | null {
  if (!c.actual_joining_date) return null;
  return c.confirmation_date ?? addDays(probationEnd(c.actual_joining_date), 1);
}

/**
 * none: not a working employee, or an old probation from before the portal did this.
 * upcoming: probation still running. due: HR must approve. approved: waiting for the 1st. send: the letter can go out.
 */
export type ConfirmationState = "none" | "upcoming" | "due" | "approved" | "send";

export function confirmationState(c: C, now: Date = new Date()): ConfirmationState {
  const d = confirmationDate(c);
  if (!working(c) || !d) return "none";
  const today = todayIst(now);
  if (c.confirmation_approved_at) return today >= d ? "send" : "approved";
  if (d < addDays(today, -BACKLOG_DAYS)) return "none";
  return today >= addDays(d, -ALERT_DAYS_BEFORE) ? "due" : "upcoming";
}

/** Date printed on the letter: the confirmation date, or the approval day if HR approved later. */
export function letterDate(c: C): string {
  const d = confirmationDate(c) ?? todayIst();
  const approved = isoToIstDate(c.confirmation_approved_at ?? null);
  return approved && approved > d ? approved : d;
}
