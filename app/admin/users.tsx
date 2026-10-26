"use client";
import { useState, useTransition } from "react";
import type { Branch, Profile, Role } from "@/lib/types";
import { adminCreateUser, adminDeleteUser, adminResetPassword, superSetRole } from "@/app/actions/users";
import { Badge, Flash } from "@/components/ui";

const ROLE_LABEL: Record<Role, string> = { superadmin: "super admin", admin: "admin", hr: "HR", branch: "store" };
const ROLE_TONE = { superadmin: "purple", admin: "red", hr: "sky", branch: "slate" } as const;

/** Admins manage HR and store logins; only the super admin manages admins (the database enforces the same rules). */
export function UsersAdmin({ me, people, branches }: { me: Profile; people: Profile[]; branches: Branch[] }) {
  const isSuper = me.role === "superadmin";
  const [pw, setPw] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ username: "", full_name: "", role: "hr", branch_id: "", password: "" });
  const canManage = (p: Profile) => p.id === me.id || isSuper || p.role === "hr" || p.role === "branch";
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => setMsg(await fn()));
  const roles: Role[] = isSuper ? ["hr", "branch", "admin", "superadmin"] : ["hr", "branch"];
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-bold">Logins</h2>
      <p className="mb-2 text-xs text-slate-500">
        {isSuper ? "You are the super admin: you can add, remove, reset and change any login." : "You can add, remove and reset HR and store logins. Admin logins are managed by the super admin."}
      </p>
      <Flash msg={msg} />

      <form className="mb-3 grid gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2"
        onSubmit={(e) => { e.preventDefault(); run(async () => {
          const r = await adminCreateUser({ ...form, branch_id: form.branch_id || null });
          if (r.ok) setForm({ username: "", full_name: "", role: "hr", branch_id: "", password: "" });
          return r;
        }); }}>
        <input className="input" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <input className="input" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        {form.role === "branch"
          ? <select className="input" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} required>
              <option value="">-- Store --</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          : <span />}
        <input className="input" type="password" placeholder="Password (8+ characters)" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button className="btn-primary" disabled={pending}>+ Add login</button>
      </form>

      <div className="max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>{people.map((p) => (
            <tr key={p.id} className="border-b align-middle last:border-0">
              <td className="py-1.5 pr-2">
                <b>{p.username}</b> <Badge tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                {p.id === me.id && <span className="ml-1 text-xs text-slate-500">(you)</span>}
                {p.branch_id && <div className="text-xs text-slate-500">{branchName.get(p.branch_id)}</div>}
              </td>
              {canManage(p) ? <>
                <td className="w-36"><input type="password" className="input" placeholder="New password" autoComplete="new-password" value={pw[p.id] ?? ""} onChange={(e) => setPw((s) => ({ ...s, [p.id]: e.target.value }))} /></td>
                <td className="whitespace-nowrap pl-2 text-right">
                  <button className="btn-outline !py-1" disabled={pending || !pw[p.id]} onClick={() => run(async () => { const r = await adminResetPassword(p.id, pw[p.id]); setPw((s) => ({ ...s, [p.id]: "" })); return r; })}>Reset</button>{" "}
                  {isSuper && p.id !== me.id && p.role !== "branch" && (
                    <select className="input !inline-block !w-auto !py-1 text-xs" value={p.role} disabled={pending}
                      onChange={(e) => confirm(`Make ${p.username} ${ROLE_LABEL[e.target.value as Role]}?`) && run(() => superSetRole(p.id, e.target.value))}>
                      {(["hr", "admin", "superadmin"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  )}{" "}
                  {p.id !== me.id && (
                    <button className="btn-outline !py-1 text-red-700" disabled={pending}
                      onClick={() => confirm(`Remove the login "${p.username}"? They won't be able to sign in. Their candidates and history stay.`) && run(() => adminDeleteUser(p.id))}>Remove</button>
                  )}
                </td>
              </> : <td colSpan={2} className="text-right text-xs text-slate-400">managed by the super admin</td>}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
