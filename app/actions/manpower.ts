"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";

type Result = { ok: boolean; message: string };

export async function requestManpower(input: { branch_id: string; post: string; headcount: number; needed_by: string; reason: string }): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  const branchId = profile.role === "branch" ? profile.branch_id : input.branch_id;
  const post = input.post.trim().slice(0, 120);
  const headcount = Math.round(Number(input.headcount));
  if (!branchId || !post) return { ok: false, message: "Choose the branch and the post." };
  if (!(headcount >= 1 && headcount <= 50)) return { ok: false, message: "Number of people must be 1 to 50." };
  const { error } = await supabase.from("manpower_requests").insert({
    branch_id: branchId, post, headcount, needed_by: input.needed_by || null, reason: input.reason.trim().slice(0, 500) || null,
  });
  if (error) return { ok: false, message: error.message };
  const { data: admins } = await supabase.from("profiles").select("username").in("role", ["admin", "superadmin"]);
  if (admins?.length) {
    await supabase.from("notifications").insert(admins.map((a) => ({
      sender: profile.username, recipient: a.username, message: `Manpower request: ${headcount} × ${post}. Please review on the Manpower page.`,
    })));
  }
  revalidatePath("/manpower");
  return { ok: true, message: "Request sent to admin." };
}

export async function setManpowerStatus(id: string, status: "approved" | "filled" | "cancelled"): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (status !== "cancelled" && !isAdminRole(profile.role)) return { ok: false, message: "Only an admin can approve or close requests." };
  const { error } = await supabase.from("manpower_requests")
    .update({ status, decided_by: isAdminRole(profile.role) ? profile.username : null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/manpower");
  revalidatePath("/careers");
  return { ok: true, message: status === "approved" ? "Approved. It now shows as urgent on the careers page." : "Updated." };
}
