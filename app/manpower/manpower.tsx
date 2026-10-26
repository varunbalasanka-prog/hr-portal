"use client";
import { useState, useTransition } from "react";
import { requestManpower, setManpowerStatus } from "@/app/actions/manpower";
import { formatDate } from "@/lib/dates";
import type { Branch, Profile } from "@/lib/types";
import { Badge, Field, Flash } from "@/components/ui";

export type ManpowerRow = {
  id: string; branch_id: string; post: string; headcount: number; needed_by: string | null; reason: string | null;
  status: "requested" | "approved" | "filled" | "cancelled"; requested_by: string; decided_by: string | null; created_at: string;
};
const TONE = { requested: "amber", approved: "sky", filled: "green", cancelled: "zinc" } as const;

/** Branches ask for people; admins approve (shown as "urgent" on the careers page), then mark filled. */
export function Manpower({ me, admin, rows, branches, posts }: { me: Profile; admin: boolean; rows: ManpowerRow[]; branches: Branch[]; posts: Record<string, string[]> }) {
  const [f, setF] = useState({ branch_id: me.role === "branch" ? me.branch_id ?? "" : "", post: "", headcount: 1, needed_by: "", reason: "" });
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const bName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";
  const open = rows.filter((r) => r.status === "requested" || r.status === "approved");
  const closed = rows.filter((r) => r.status === "filled" || r.status === "cancelled");

  const table = (list: ManpowerRow[]) => (
    <table className="w-full text-sm">
      <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-1.5">Branch</th><th>Post</th><th>People</th><th>Needed by</th><th>Status</th><th>Asked by</th><th /></tr></thead>
      <tbody>{list.map((r) => (
        <tr key={r.id} className="border-b align-top last:border-0">
          <td className="py-1.5">{bName(r.branch_id)}</td>
          <td>{r.post}{r.reason && <div className="text-xs text-slate-500">{r.reason}</div>}</td>
          <td className="tabular-nums">{r.headcount}</td>
          <td>{formatDate(r.needed_by)}</td>
          <td><Badge tone={TONE[r.status]}>{r.status}</Badge></td>
          <td className="text-xs">{r.requested_by}<br />{formatDate(r.created_at)}</td>
          <td className="space-x-1 whitespace-nowrap text-right">
            {admin && r.status === "requested" && <button className="btn-success !py-0.5 text-xs" disabled={pending} onClick={() => start(async () => setMsg(await setManpowerStatus(r.id, "approved")))}>Approve</button>}
            {admin && r.status === "approved" && <button className="btn-success !py-0.5 text-xs" disabled={pending} onClick={() => start(async () => setMsg(await setManpowerStatus(r.id, "filled")))}>Filled</button>}
            {(admin || (r.requested_by === me.username && r.status === "requested")) && (r.status === "requested" || r.status === "approved") &&
              <button className="btn-outline !py-0.5 text-xs" disabled={pending} onClick={() => start(async () => setMsg(await setManpowerStatus(r.id, "cancelled")))}>Cancel</button>}
          </td>
        </tr>
      ))}</tbody>
    </table>
  );

  return (
    <div className="grid gap-4 px-4 sm:px-6 lg:grid-cols-3">
      <section className="card space-y-3 p-4 sm:p-5 lg:col-span-1">
        <h2 className="text-sm font-bold">Ask for staff</h2>
        {me.role !== "branch" && (
          <Field label="Branch *">
            <select className="input" value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: e.target.value, post: "" })}>
              <option value="">-- Select --</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Post *">
          <select className="input" value={f.post} onChange={(e) => setF({ ...f, post: e.target.value })} disabled={!f.branch_id}>
            <option value="">-- Select --</option>
            {(posts[f.branch_id] ?? []).map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="How many people *"><input className="input" type="number" min={1} max={50} value={f.headcount} onChange={(e) => setF({ ...f, headcount: Number(e.target.value) })} /></Field>
          <Field label="Needed by"><input className="input" type="date" value={f.needed_by} onChange={(e) => setF({ ...f, needed_by: e.target.value })} /></Field>
        </div>
        <Field label="Reason (replacement, new counter, festival rush…)"><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <Flash msg={msg} />
        <button className="btn-primary" disabled={pending || !f.branch_id || !f.post} onClick={() => start(async () => {
          const r = await requestManpower(f); setMsg(r); if (r.ok) setF({ ...f, post: "", headcount: 1, needed_by: "", reason: "" });
        })}>Send request</button>
      </section>
      <section className="card overflow-x-auto p-4 sm:p-5 lg:col-span-2">
        <h2 className="mb-2 text-sm font-bold">Open ({open.length})</h2>
        {open.length ? table(open) : <p className="text-sm text-slate-500">No open requests.</p>}
        {closed.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">Closed ({closed.length})</summary>{table(closed)}</details>}
      </section>
    </div>
  );
}
