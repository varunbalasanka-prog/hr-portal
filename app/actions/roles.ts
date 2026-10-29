"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

type Result = { ok: boolean; message: string };

const NOT_READY = "The role list isn't set up yet. An admin needs to run 0025_job_roles.sql in Supabase.";
const cleanName = (s: string) => s.trim().replace(/\s+/g, " ").slice(0, 120);

function done(message: string): Result {
  for (const p of ["/admin", "/apply", "/careers", "/manpower", "/dashboard", "/staff"]) revalidatePath(p);
  return { ok: true, message };
}

function rpcResult(error: { message: string } | null, code: unknown, ok: string): Result {
  if (error) return { ok: false, message: error.message.includes("function") && error.message.includes("does not exist") ? NOT_READY : error.message };
  if (code === "exists") return { ok: false, message: "Another role already has that name." };
  if (code === "bad_name") return { ok: false, message: "Type a name (up to 120 letters)." };
  if (code === "not_found") return { ok: false, message: "Not found. Reload the page and try again." };
  return done(ok);
}

/** Adds a role to the company list. It opens nowhere until it is ticked for a firm and then for a store. */
export async function addRole(name: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const n = cleanName(name);
  if (!n) return { ok: false, message: "Type the role's name." };
  const { data: same, error } = await supabase.from("job_roles").select("id, name, active").ilike("name", n.replace(/[%_\\]/g, "\\$&"));
  if (error) return { ok: false, message: error.message.includes("job_roles") ? NOT_READY : error.message };
  const old = (same ?? [])[0] as { id: string; name: string; active: boolean } | undefined;
  if (old?.active) return { ok: false, message: `"${old.name}" is already on the list.` };
  if (old) {
    const { data, error: e } = await supabase.rpc("set_job_role_active", { p_id: old.id, p_active: true });
    return rpcResult(e, data, `"${old.name}" was deleted before, so it has been restored.`);
  }
  const { error: e } = await supabase.from("job_roles").insert({ name: n });
  if (e) return { ok: false, message: e.message };
  return done(`Added "${n}". Tick it for the firms that have it.`);
}

/** Renames a role on every live list. Past candidates, requests and staff records keep the old name. */
export async function renameRole(id: string, name: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("rename_job_role", { p_id: id, p_name: cleanName(name) });
  return rpcResult(error, data, "Renamed. Past records keep the old name.");
}

/** Delete hides the role from every list and closes it at every store. Restore brings it back for the firms it had. */
export async function setRoleActive(id: string, active: boolean): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("set_job_role_active", { p_id: id, p_active: active });
  return rpcResult(error, data, active ? "Restored for the firms it had before. Tick it again under Store posts to reopen it." : "Deleted. It is closed at every store; past records keep it.");
}

/** Sets which roles one firm has. Roles taken off are also closed at the firm's stores. */
export async function saveFirmRoles(division: string, roleIds: string[]): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("set_division_roles", { p_division: division, p_roles: [...new Set(roleIds)] });
  return rpcResult(error, data, `Saved ${new Set(roleIds).size} roles for ${division}.`);
}
