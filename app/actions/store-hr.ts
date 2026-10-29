"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { pushTo } from "@/lib/push";

export type MoveMode = "all" | "open" | "none";

/** Gives a store to another HR and moves its candidates to them (all, only those in progress, or none). */
export async function setStoreHr(branchId: string, hr: string, move: MoveMode = "all"): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await requireAdmin();
  const { data: b } = await supabase.from("branches").select("name, hr_username").eq("id", branchId).single<{ name: string; hr_username: string }>();
  const { data: moved, error } = await supabase.rpc("set_store_hr", { p_branch: branchId, p_hr: hr, p_move: move });
  if (error) return { ok: false, message: error.message };
  const n = (moved as number) ?? 0;
  if (b && b.hr_username !== hr) await pushTo(hr, { title: "New store for you", body: `You now look after ${b.name}.`, url: "/dashboard" });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true, message: `${b?.name ?? "Store"} is now looked after by ${hr}.${n ? ` ${n} candidate${n === 1 ? "" : "s"} moved to them.` : ""}` };
}
