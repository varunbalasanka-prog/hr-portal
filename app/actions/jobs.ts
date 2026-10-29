"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

type Result = { ok: boolean; message: string };

function done(message: string): Result {
  revalidatePath("/admin");
  revalidatePath("/careers");
  revalidatePath("/jobs/[town]/[slug]", "page");
  revalidatePath("/sitemap.xml");
  return { ok: true, message };
}

export type OpeningInput = { id: string; closes_on: string | null; salary_min: number | null; salary_max: number | null };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const money = (n: number | null) => (n == null || Number.isNaN(n) ? null : Math.round(n));

/** Saves closing dates and monthly salary ranges for one store's open jobs. */
export async function saveOpenings(rows: OpeningInput[]): Promise<Result> {
  const { supabase } = await requireAdmin();
  for (const r of rows) {
    const lo = money(r.salary_min), hi = money(r.salary_max);
    if (r.closes_on && !DATE.test(r.closes_on)) return { ok: false, message: "Pick a valid closing date." };
    if ((lo != null && lo <= 0) || (hi != null && hi <= 0)) return { ok: false, message: "Salary must be more than 0." };
    if (lo != null && hi != null && hi < lo) return { ok: false, message: "Salary 'to' must be the same as or more than 'from'." };
    const { error } = await supabase.from("job_openings").update({ closes_on: r.closes_on || null, salary_min: lo, salary_max: hi }).eq("id", r.id);
    if (error) return { ok: false, message: error.message };
  }
  return done(`Saved ${rows.length} job${rows.length === 1 ? "" : "s"}. Google sees the change within a day or two.`);
}

/** Street and PIN code shown on this store's job pages. */
export async function saveStoreAddress(branchId: string, street: string, pin: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const s = street.replace(/\s+/g, " ").trim(), p = pin.trim();
  if (p && !/^\d{6}$/.test(p)) return { ok: false, message: "PIN code must be 6 digits." };
  const { error } = await supabase.from("branches").update({ street_address: s || null, postal_code: p || null }).eq("id", branchId);
  if (error) return { ok: false, message: error.message };
  return done("Address saved.");
}

export type RoleInput = { name: string; summary: string; duties: string; requirements: string; shift: string; benefits: string };

const tidy = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean).join("\n").slice(0, 3000);

/** What a post involves, shown on every job page for that post. */
export async function saveRole(input: RoleInput): Promise<Result> {
  const { supabase } = await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Pick a post." };
  const { error } = await supabase.from("job_roles").upsert({
    name, summary: input.summary.trim().slice(0, 500), duties: tidy(input.duties), requirements: tidy(input.requirements),
    shift: input.shift.trim().slice(0, 200), benefits: tidy(input.benefits), updated_at: new Date().toISOString(),
  }, { onConflict: "name" });
  if (error) return { ok: false, message: error.message };
  return done(`Saved the description for ${name}.`);
}
