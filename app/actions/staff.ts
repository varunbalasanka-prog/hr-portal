"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";

type Result = { ok: boolean; message: string };

/** Admin regroups stores into divisions. A move between stores of one division is "moved out", not a loss. */
export async function saveDivisions(changes: { id: string; division: string }[]): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!isAdminRole(profile.role)) return { ok: false, message: "Only an admin can change divisions." };
  const clean = changes.map((c) => ({ id: c.id, division: c.division.trim().slice(0, 60) }));
  if (clean.some((c) => !c.division)) return { ok: false, message: "Every store needs a division name." };
  for (const c of clean) {
    const { error } = await supabase.from("branches").update({ division: c.division }).eq("id", c.id);
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/staff");
  return { ok: true, message: clean.length === 1 ? "Division saved." : `${clean.length} stores updated.` };
}
