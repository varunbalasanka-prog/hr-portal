/**
 * One-time migration from the Google Sheet into Supabase.
 * Run after seed-users:  npm run import:sheet
 * Needs .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GOOGLE_SERVICE_ACCOUNT_JSON.
 */
import { createClient } from "@supabase/supabase-js";
import { importAll } from "../lib/sheet-sync";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
importAll(db).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
