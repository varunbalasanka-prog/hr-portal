/**
 * One-time migration from the Google Sheet into Supabase.  npm run import:sheet
 * Needs .env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SYNC_USERNAME,
 * SYNC_PASSWORD and GOOGLE_SERVICE_ACCOUNT_JSON. It signs in as the sync admin account.
 */
import { createSyncClient } from "../lib/supabase/sync";
import { importAll } from "../lib/sheet-sync";

createSyncClient()
  .then((db) => importAll(db))
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
