"use client";
import { useState, useTransition } from "react";
import { addRole, renameRole, saveFirmRoles, setRoleActive } from "@/app/actions/roles";
import { Badge, Flash } from "@/components/ui";
import type { FirmRoles, JobRole } from "@/lib/job-roles";
import { divisionOf } from "@/lib/staff";
import type { Branch } from "@/lib/types";

/** The company role list (admin only): which roles exist, and which firm has which. Stores open posts from their firm's list. */
export function JobRolesAdmin({ roles, firms, branches }: { roles: JobRole[] | null; firms: FirmRoles; branches: Branch[] }) {
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const firmNames = [...new Set(branches.map((b) => divisionOf(b)))].sort((a, b) => a.localeCompare(b));
  const [firm, setFirm] = useState(firmNames[0] ?? "");
  const [ticked, setTicked] = useState<string[]>(firms[firmNames[0]] ?? []);
  const [newName, setNewName] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  if (!roles) {
    return <section className="card p-4 text-sm text-amber-900 sm:p-5">The role list isn&apos;t set up yet. An admin needs to run 0024_job_listings.sql and then 0025_job_roles.sql in Supabase.</section>;
  }
  const live = roles.filter((r) => r.active).sort((a, b) => a.name.localeCompare(b.name));
  const deleted = roles.filter((r) => !r.active);
  const saved = firms[firm] ?? [];
  const liveIds = live.map((r) => r.id);
  const dirty = ticked.filter((id) => liveIds.includes(id)).sort().join() !== saved.filter((id) => liveIds.includes(id)).sort().join();
  const usedBy = (id: string) => firmNames.filter((f) => (firms[f] ?? []).includes(id)).length;
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => setMsg(await fn()));

  const pick = (f: string) => {
    if (dirty && !confirm("Discard the unsaved changes for this firm?")) return;
    setFirm(f); setTicked(firms[f] ?? []); setMsg(null);
  };
  const toggle = (id: string) => setTicked((t) => t.includes(id) ? t.filter((x) => x !== id) : [...t, id]);
  const saveFirm = () => {
    const off = live.filter((r) => saved.includes(r.id) && !ticked.includes(r.id)).map((r) => r.name);
    if (off.length && !confirm(`Take ${off.join(", ")} off ${firm}?\n\nIf any of its stores has it open, it closes there too.`)) return;
    run(() => saveFirmRoles(firm, ticked.filter((id) => liveIds.includes(id))));
  };
  const rename = (r: JobRole) => {
    const n = prompt(`New name for "${r.name}".\n\nPast candidates, requests and staff records keep the old name.`, r.name);
    if (n && n.trim() !== r.name) run(() => renameRole(r.id, n));
  };
  const remove = (r: JobRole) => {
    if (confirm(`Delete "${r.name}"?\n\nIt disappears from every role list and closes at every store. Past records keep it, and you can restore it later.`)) run(() => setRoleActive(r.id, false));
  };

  return (
    <div className="space-y-4">
      <Flash msg={msg} />
      <section className="card p-4 sm:p-5">
        <h2 className="mb-1 text-sm font-bold">Roles at each firm</h2>
        <p className="mb-2 text-xs text-slate-500">
          All stores of a firm share its list. Stores pick from it for manpower requests, walk-ins and designations,
          and you open posts from it under Store posts.
        </p>
        <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
          <ul className="max-h-[28rem] overflow-y-auto rounded border border-slate-200 text-sm">
            {firmNames.map((f) => {
              const n = (firms[f] ?? []).filter((id) => liveIds.includes(id)).length;
              return (
                <li key={f}>
                  <button onClick={() => pick(f)}
                    className={`flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-sky-50 ${f === firm ? "bg-sky-100 font-semibold" : ""}`}>
                    <span>{f} <span className="text-xs font-normal text-slate-500">({branches.filter((b) => divisionOf(b) === f).length} stores)</span></span>
                    {n ? <Badge tone="green">{n}</Badge> : <Badge tone="red">none</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
          {firm && (
            <div>
              <div className="mb-2 text-sm"><b>{firm}</b>: {branches.filter((b) => divisionOf(b) === firm).map((b) => b.name).join(", ")}</div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {live.map((r) => (
                  <label key={r.id} className={`flex items-center gap-2 rounded border px-2 py-1.5 text-sm ${ticked.includes(r.id) ? "border-green-300 bg-green-50" : "border-slate-200"}`}>
                    <input type="checkbox" checked={ticked.includes(r.id)} onChange={() => toggle(r.id)} /> {r.name}
                  </label>
                ))}
              </div>
              <button className="btn-primary mt-3" disabled={pending || !dirty} onClick={saveFirm}>{pending ? "Saving…" : dirty ? `Save ${firm}` : "Saved"}</button>
            </div>
          )}
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-1 text-sm font-bold">Company role list ({live.length})</h2>
        <p className="mb-2 text-xs text-slate-500">Only admins can add, rename or delete roles. A new role belongs to no firm until you tick it above.</p>
        <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) run(async () => { const r = await addRole(newName); if (r.ok) setNewName(""); return r; }); }}>
          <input className="input max-w-xs" placeholder="New role, e.g. Showroom Supervisor" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn-primary" disabled={pending || !newName.trim()}>Add role</button>
        </form>
        <ul className="divide-y divide-slate-100 text-sm">
          {live.map((r) => {
            const n = usedBy(r.id);
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>{r.name} {n ? <span className="text-xs text-slate-500">· {n} {n === 1 ? "firm" : "firms"}</span> : <Badge tone="amber">no firm</Badge>}</span>
                <span className="flex gap-2">
                  <button className="btn-outline !py-0.5 text-xs" disabled={pending} onClick={() => rename(r)}>Rename</button>
                  <button className="btn-outline !py-0.5 text-xs text-red-700" disabled={pending} onClick={() => remove(r)}>Delete</button>
                </span>
              </li>
            );
          })}
        </ul>
        {deleted.length > 0 && (
          <div className="mt-2 text-sm">
            <button className="text-xs text-slate-500 underline" onClick={() => setShowDeleted((s) => !s)}>{showDeleted ? "Hide" : "Show"} deleted roles ({deleted.length})</button>
            {showDeleted && <ul className="mt-1 space-y-1">{deleted.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                <span className="text-slate-500 line-through">{r.name}</span>
                <button className="btn-outline !py-0.5" disabled={pending} onClick={() => run(() => setRoleActive(r.id, true))}>Restore</button>
              </li>
            ))}</ul>}
          </div>
        )}
      </section>
    </div>
  );
}
