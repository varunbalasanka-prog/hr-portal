import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSyncClient } from "@/lib/supabase/sync";
import { deleteCandidateFiles } from "@/lib/candidate-files";
import { cleanRetention } from "@/lib/privacy";
import { pushTo } from "@/lib/push";
import { ALERT_DAYS_BEFORE, BACKLOG_DAYS } from "@/lib/confirmation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Nightly (vercel.json): tells HR about confirmations to approve, sends festival loan reminders, removes uploads from applications that were never
 *  submitted, then strips closed records older than the retention period set in Admin. Vercel sends "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const db = await createSyncClient();
    // A failed alert must not stop the clean-up; it is retried the next night (alerts are sent once each).
    const confirmations = await alertConfirmations(db).catch((e: Error) => `failed: ${e.message}`);
    const loans = await alertLoans(db).catch((e: Error) => `failed: ${e.message}`);
    const abandoned = await removeAbandonedUploads(db);
    const stripped = await stripOldRecords(db);
    return NextResponse.json({ ok: true, confirmations, loans, abandoned, stripped });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

/** Employees whose confirmation date is a week away: their HR gets a notification (written by the database) and a push. */
async function alertConfirmations(db: SupabaseClient) {
  const { data, error } = await db.rpc("send_confirmation_alerts", { p_days_before: ALERT_DAYS_BEFORE, p_backlog_days: BACKLOG_DAYS });
  if (error) throw new Error(error.message);
  const due = (data ?? []) as { hr: string; candidate: string; due: string }[];
  await Promise.all(due.map((d) => pushTo(d.hr, { title: "Confirmation to approve", body: `${d.candidate} is confirmed from ${d.due.split("-").reverse().join("/")}. Approve the letter.`, url: "/dashboard?list=confirmations" })));
  return due.length;
}

/** Festival loans (0021): tells the borrowing store two days before its people go back, and both stores once they are back. */
async function alertLoans(db: SupabaseClient) {
  const { data, error } = await db.rpc("send_loan_alerts");
  if (error) throw new Error(error.message);
  return data as number;
}

async function removeAbandonedUploads(db: SupabaseClient) {
  const { data, error } = await db.rpc("stale_upload_folders");
  if (error) throw new Error(error.message);
  const folders = (data ?? []) as string[];
  const done: string[] = [];
  for (const folder of folders) {
    const { data: files } = await db.storage.from("applications").list(folder);
    const paths = (files ?? []).map((f) => `${folder}/${f.name}`);
    if (paths.length) {
      const { error: e } = await db.storage.from("applications").remove(paths);
      if (e) continue;
    }
    done.push(folder);
  }
  if (done.length) {
    const { error: e } = await db.rpc("forget_upload_folders", { p_folders: done });
    if (e) throw new Error(e.message);
  }
  return done.length;
}

async function stripOldRecords(db: SupabaseClient) {
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "retention_months").maybeSingle();
  const months = cleanRetention(setting?.value);
  if (months === null) return 0; // clean-up switched off
  const { data, error } = await db.rpc("strip_old_candidates", { p_months: months, p_dry_run: true });
  if (error) throw new Error(error.message);
  const ids = (data ?? []) as string[];
  if (ids.length === 0) return 0;
  for (const id of ids) {
    const e = await deleteCandidateFiles(db, id);
    if (e) throw new Error(`files for ${id}: ${e}`);
  }
  const { data: done, error: e2 } = await db.rpc("strip_old_candidates", { p_months: months, p_dry_run: false });
  if (e2) throw new Error(e2.message);
  return ((done ?? []) as string[]).length;
}
