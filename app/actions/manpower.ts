"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { todayIst } from "@/lib/dates";
import { cleanTempRoles, type TempRole } from "@/lib/manpower";
import { companyRoleNames, storeRoleNames } from "@/lib/job-roles";

type Result = { ok: boolean; message: string };

export async function requestManpower(input: { branch_id: string; post: string; headcount: number; needed_by: string; reason: string }): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  const branchId = profile.role === "branch" ? profile.branch_id : input.branch_id;
  const post = input.post.trim().slice(0, 120);
  const headcount = Math.round(Number(input.headcount));
  if (!branchId || !post) return { ok: false, message: "Choose the branch and the post." };
  if (!(headcount >= 1 && headcount <= 50)) return { ok: false, message: "Number of people must be 1 to 50." };
  // The request closes by itself after this date (0027), so it is required.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.needed_by) || input.needed_by < todayIst()) return { ok: false, message: "Choose the needed-by date (today or later)." };
  const allowed = await storeRoleNames(supabase, branchId);
  if (allowed && !allowed.includes(post)) return { ok: false, message: "Pick a post from the list. Ask an admin to add a role that is missing." };
  const { error } = await supabase.from("manpower_requests").insert({
    branch_id: branchId, post, headcount, needed_by: input.needed_by, reason: input.reason.trim().slice(0, 500) || null,
  });
  if (error) return { ok: false, message: error.message };
  // The store's HR and the admins are told by the database (0026).
  revalidatePath("/manpower");
  return { ok: true, message: "Request sent to the admins and your HR." };
}

/** Festival help (0021): several roles with a headcount each, for fixed dates. The store's HR and admins are told by the database. */
export async function requestTemporaryStaff(input: { branch_id: string; roles: TempRole[]; start_date: string; end_date: string; reason: string }): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  const branchId = profile.role === "branch" ? profile.branch_id : input.branch_id;
  if (!branchId) return { ok: false, message: "Choose the branch." };
  const roles = cleanTempRoles(input.roles);
  if (typeof roles === "string") return { ok: false, message: roles };
  const allowed = await companyRoleNames(supabase);
  const unknown = allowed && roles.find((r) => !allowed.includes(r.post));
  if (unknown) return { ok: false, message: `"${unknown.post}" isn't on the role list. Pick one from the list, or ask an admin to add it.` };
  const { start_date: from, end_date: to } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { ok: false, message: "Choose the from and to dates." };
  if (to < from) return { ok: false, message: "The last day must be on or after the first day." };
  const total = roles.reduce((n, r) => n + r.headcount, 0);
  const { error } = await supabase.from("manpower_requests").insert({
    branch_id: branchId, kind: "temporary", roles, start_date: from, end_date: to, needed_by: from,
    post: roles.map((r) => `${r.headcount} × ${r.post}`).join(", ").slice(0, 120), headcount: total,
    reason: input.reason.trim().slice(0, 500) || null,
  });
  if (error) return { ok: false, message: error.message.includes("manpower_temporary_shape") || error.message.includes("kind") ? "Temporary requests aren't set up yet. An admin needs to run 0021_temporary_staff.sql." : error.message };
  revalidatePath("/manpower");
  return { ok: true, message: "Request sent to HR." };
}

/** Admin approves a permanent request (0026). If the post wasn't open at the store, approving opens it. */
export async function approveManpower(id: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!isAdminRole(profile.role)) return { ok: false, message: "Only an admin can approve permanent requests." };
  const { data, error } = await supabase.rpc("approve_manpower_request", { p_request: id });
  if (error) return { ok: false, message: error.message.includes("approve_manpower_request") ? "An admin needs to run 0026_manpower_gaps.sql first." : error.message };
  revalidatePath("/manpower");
  revalidatePath("/careers");
  const opened = (data as { opened?: boolean } | null)?.opened;
  return { ok: true, message: `Approved.${opened ? " The post wasn't open at this store, so it is now open on the careers page." : ""}` };
}

/** The store's HR (or an admin) ends an approved permanent request early (0027). It also closes by itself once enough
 *  people have joined or its needed-by date has passed. */
export async function closeManpower(id: string): Promise<Result> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("close_manpower_request", { p_request: id });
  if (error) return { ok: false, message: error.message.includes("close_manpower_request") ? "An admin needs to run 0027_manpower_close.sql first." : error.message };
  revalidatePath("/manpower");
  revalidatePath("/careers");
  return { ok: true, message: "Closed. The store and its HR have been told." };
}

export async function setManpowerStatus(id: string, status: "cancelled"): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (status === "cancelled") {
    const { count } = await supabase.from("manpower_requests").select("id", { count: "exact", head: true }).eq("id", id).eq("kind", "temporary").neq("status", "requested");
    if (count) {
      const { data: loans } = await supabase.rpc("staff_loans_list", { p_request: id });
      if (Array.isArray(loans) && loans.length) return { ok: false, message: "People are already assigned. Send them back first, then cancel." };
    }
  }
  const { error } = await supabase.from("manpower_requests")
    .update({ status, decided_by: isAdminRole(profile.role) ? profile.username : null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/manpower");
  revalidatePath("/careers");
  return { ok: true, message: "Updated." };
}

async function rpc(fn: string, args: Record<string, unknown>, done: string): Promise<Result> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/manpower");
  return { ok: true, message: done };
}

export async function decideTempRequest(id: string, approve: boolean, note: string): Promise<Result> {
  return rpc("decide_temp_request", { p_request: id, p_approve: approve, p_note: note.trim().slice(0, 300) || null },
    approve ? "Approved. Now pick the people to send." : "Request turned down. The store has been told.");
}

export type PoolPerson = {
  employment_id: string; name: string; employee_code: string | null; designation: string | null; branch_id: string;
  busy: { to_branch_id: string; start_date: string; end_date: string }[] | null;
};

/** Staff working at other stores today, for HR to pick from. */
export async function loanPool(id: string): Promise<{ ok: boolean; message: string; people: PoolPerson[] }> {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("loan_pool", { p_request: id });
  if (error) return { ok: false, message: error.message, people: [] };
  return { ok: true, message: "", people: (data as PoolPerson[]) ?? [] };
}

export async function assignTempStaff(id: string, people: { employment_id: string; post: string }[]): Promise<Result> {
  if (!people.length) return { ok: false, message: "Tick at least one person." };
  return rpc("assign_temp_staff", { p_request: id, p_people: people },
    `${people.length === 1 ? "1 person" : `${people.length} people`} sent. Both stores have been told.`);
}

/** Before the loan starts this removes the person; after, their last day at the borrowing store becomes today. */
export async function endStaffLoan(loanId: string): Promise<Result> {
  return rpc("end_staff_loan", { p_loan: loanId, p_last_day: null }, "Done. Both stores have been told.");
}
