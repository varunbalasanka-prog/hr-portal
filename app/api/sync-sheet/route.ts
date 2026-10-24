import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncNewApplications } from "@/lib/sheet-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called by Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncNewApplications(createAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
