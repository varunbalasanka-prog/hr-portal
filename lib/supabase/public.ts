import { createClient } from "@supabase/supabase-js";

/** Anonymous client for the public candidate pages. It can only call the token RPCs and upload into the candidate's own folder. */
export function createPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
