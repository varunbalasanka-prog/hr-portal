import type { SupabaseClient } from "@supabase/supabase-js";
import type { Branch } from "./types";
import { divisionOf } from "./staff";

/** A company role (0024/0025). Delete sets active = false, so past records keep making sense. */
export type JobRole = { id: string; name: string; active: boolean };
/** Firm (division) -> role ids it has. */
export type FirmRoles = Record<string, string[]>;

/** Live roles and which firm has which, or null until 0025 is run. */
export async function loadFirmRoles(supabase: SupabaseClient): Promise<{ roles: JobRole[]; firms: FirmRoles } | null> {
  const [{ data: roles, error }, { data: links, error: linkError }] = await Promise.all([
    supabase.from("job_roles").select("id, name, active").order("sort").order("name"),
    supabase.from("division_roles").select("division, role_id"),
  ]);
  if (error || linkError) return null;
  const firms: FirmRoles = {};
  for (const l of (links ?? []) as { division: string; role_id: string }[]) (firms[l.division] ??= []).push(l.role_id);
  return { roles: (roles ?? []) as JobRole[], firms };
}

/** Gives each store the names of the live roles its firm has (store.roles), sorted. Stores are unchanged until 0025 is run. */
export async function withFirmRoles(supabase: SupabaseClient, branches: Branch[]): Promise<Branch[]> {
  const data = await loadFirmRoles(supabase);
  if (!data) return branches;
  return branches.map((b) => ({ ...b, roles: firmRoleNames(data.roles, data.firms[divisionOf(b)] ?? []) }));
}

export function firmRoleNames(roles: JobRole[], ids: string[]): string[] {
  return roles.filter((r) => r.active && ids.includes(r.id)).map((r) => r.name).sort((a, b) => a.localeCompare(b));
}

/** The role names one store may use, or null when 0025 isn't run yet (callers then skip the check). */
export async function storeRoleNames(supabase: SupabaseClient, branchId: string): Promise<string[] | null> {
  const { data: b } = await supabase.from("branches").select("id, name, division").eq("id", branchId).maybeSingle();
  if (!b) return [];
  const data = await loadFirmRoles(supabase);
  return data ? firmRoleNames(data.roles, data.firms[divisionOf(b as Branch)] ?? []) : null;
}

/** Options for a role dropdown: the store's roles, plus the saved value if it is an old or merged name. */
export function roleOptions(roles: string[], current?: string | null): string[] {
  return current && !roles.includes(current) ? [current, ...roles] : roles;
}

/** Every live role some firm has (temporary staff can come from any firm), or null before 0025. */
export async function companyRoleNames(supabase: SupabaseClient): Promise<string[] | null> {
  const data = await loadFirmRoles(supabase);
  return data ? firmRoleNames(data.roles, Object.values(data.firms).flat()) : null;
}
