import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSyncClient } from "@/lib/supabase/sync";
import { deleteCandidateFiles } from "@/lib/candidate-files";
import { cleanRetention } from "@/lib/privacy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Nightly (vercel.json): removes uploads from applications that were never submitted, then strips closed
 *  records older than the retention period set in Admin. Vercel sends "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const db = await createSyncClient();
    const abandoned = await removeAbandonedUploads(db);
    const stripped = await stripOldRecords(db);
    return NextResponse.json({ ok: true, abandoned, stripped });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
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
