import "server-only";
import { notFound } from "next/navigation";
import { createAdminClient } from "./supabase/admin";
import type { Branch, Candidate } from "./types";

/** Candidate + branch for a letter link. The token is a random UUID, so links can't be guessed from a mobile number. */
export async function loadLetter(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const admin = createAdminClient();
  const { data: c } = await admin.from("candidates").select("*").eq("access_token", token).maybeSingle<Candidate>();
  if (!c) notFound();
  const branchId = c.branch_id;
  const { data: branch } = branchId
    ? await admin.from("branches").select("*").eq("id", branchId).maybeSingle<Branch>()
    : await admin.from("branches").select("*").eq("name", c.applied_locations[0] ?? "").maybeSingle<Branch>();
  const address = branch?.address ?? "Balasanka Group of Companies, Tamil Nadu";
  const companyName = address.split(",")[0].trim();
  return { c, branch, address, companyName };
}
