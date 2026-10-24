import { createClient } from "@supabase/supabase-js";
import { usernameToEmail } from "../usernames";

/**
 * Client signed in as the sync admin account (SYNC_USERNAME / SYNC_PASSWORD).
 * Used by the Sheet cron and the import script, so no service-role key is needed anywhere.
 */
export async function createSyncClient() {
  const username = process.env.SYNC_USERNAME;
  const password = process.env.SYNC_PASSWORD;
  if (!username || !password) throw new Error("SYNC_USERNAME and SYNC_PASSWORD must be set");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error) throw new Error(`Sync login failed: ${error.message}`);
  return db;
}
