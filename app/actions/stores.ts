"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

type Result = { ok: boolean; message: string };

export type StoreInput = {
  brand: string; town: string; division: string; business_type: string; hr_username: string;
  address: string; street_address: string; postal_code: string;
};

const clean = (s: string | undefined, max = 200) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function done(message: string): Result {
  for (const p of ["/admin", "/dashboard", "/staff", "/manpower", "/apply", "/careers"]) revalidatePath(p);
  revalidatePath("/jobs/[town]/[slug]", "page");
  return { ok: true, message };
}

/** Store names are "Brand - Town", e.g. "Tanishq - Theni". The name is fixed once saved: old applications refer to it. */
export async function addStore(input: StoreInput): Promise<Result> {
  const { supabase } = await requireAdmin();
  const brand = clean(input.brand, 60), town = clean(input.town, 60);
  const postal = clean(input.postal_code, 6);
  if (!brand || !town) return { ok: false, message: "Enter the brand and the town." };
  if (!clean(input.business_type, 40)) return { ok: false, message: "Pick the business type." };
  if (!clean(input.hr_username, 60)) return { ok: false, message: "Pick the HR who looks after this store." };
  if (postal && !/^\d{6}$/.test(postal)) return { ok: false, message: "PIN code must be 6 digits." };
  const name = `${brand} - ${town}`;
  const { data: same } = await supabase.from("branches").select("id").ilike("name", name).maybeSingle();
  if (same) return { ok: false, message: `${name} already exists.` };
  const { error } = await supabase.from("branches").insert({
    name, town, division: clean(input.division, 60) || brand, business_type: clean(input.business_type, 40),
    hr_username: clean(input.hr_username, 60), address: clean(input.address, 500) || null,
    street_address: clean(input.street_address, 200) || null, postal_code: postal || null,
  });
  if (error) return { ok: false, message: error.message };
  return done(`${name} added. Next: open posts for it under Store posts, and add its store login under Logins.`);
}

/** Edits a store's details (not its name). */
export async function updateStore(id: string, input: Pick<StoreInput, "town" | "business_type" | "address" | "street_address" | "postal_code">): Promise<Result> {
  const { supabase } = await requireAdmin();
  const town = clean(input.town, 60), postal = clean(input.postal_code, 6);
  if (!town) return { ok: false, message: "Enter the town." };
  if (!clean(input.business_type, 40)) return { ok: false, message: "Pick the business type." };
  if (postal && !/^\d{6}$/.test(postal)) return { ok: false, message: "PIN code must be 6 digits." };
  const { error } = await supabase.from("branches").update({
    town, business_type: clean(input.business_type, 40), address: clean(input.address, 500) || null,
    street_address: clean(input.street_address, 200) || null, postal_code: postal || null,
  }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return done("Store details saved.");
}

export async function deleteStore(id: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("delete_store", { p_branch: id });
  if (error) return { ok: false, message: error.message };
  return done("Store deleted.");
}

/** Admin changes a designation from the candidate panel (any stage, including staff already working). */
export async function changeCandidateDesignation(candidateId: string, designation: string, kind: string, from: string, reason: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  if (!clean(designation, 80)) return { ok: false, message: "Pick a designation." };
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) return { ok: false, message: "Pick a valid start date." };
  const { data, error } = await supabase.rpc("set_candidate_designation", {
    p_candidate: candidateId, p_designation: clean(designation, 80), p_kind: kind, p_from: from || null, p_reason: clean(reason, 300) || null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/staff");
  return { ok: true, message: data === "correction" ? "Designation corrected." : data === "updated" ? "Designation changed." : `Designation changed (${data}). The staff record shows the change from the start date.` };
}

/** Admin changes a designation from the Staff page. */
export async function changeStaffDesignation(employmentId: string, designation: string, kind: string, from: string, reason: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  if (!clean(designation, 80)) return { ok: false, message: "Pick a designation." };
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) return { ok: false, message: "Pick a valid start date." };
  const { data, error } = await supabase.rpc("change_designation", {
    p_employment: employmentId, p_designation: clean(designation, 80), p_kind: kind, p_from: from || null, p_reason: clean(reason, 300) || null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/staff");
  revalidatePath("/dashboard");
  return { ok: true, message: data === "correction" ? "Designation corrected." : `Designation changed (${data}).` };
}
