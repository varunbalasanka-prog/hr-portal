import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Deletes a candidate's files from storage. The storage API removes the file itself, which SQL alone can't. */
export async function deleteCandidateFiles(supabase: SupabaseClient, candidateId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("candidate_files", { p_candidate: candidateId });
  if (error) return error.message;
  const byBucket = new Map<string, string[]>();
  for (const f of (data ?? []) as { bucket: string; path: string }[]) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.path]);
  for (const [bucket, paths] of byBucket) {
    const { error: e } = await supabase.storage.from(bucket).remove(paths);
    if (e) return e.message;
  }
  return null;
}

