"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  assignTempStaff, decideTempRequest, endStaffLoan, loanPool, requestManpower, requestTemporaryStaff, setManpowerStatus, type PoolPerson,
} from "@/app/actions/manpower";
import { addDays, formatDate } from "@/lib/dates";
import { loanLastDay, loanState, stillNeeded, type StaffLoan, type TempRole } from "@/lib/manpower";
import type { Branch, Profile } from "@/lib/types";
import { Badge, Field, Flash, Modal } from "@/components/ui";

export type ManpowerRow = {
  id: string; branch_id: string; post: string; headcount: number; needed_by: string | null; reason: string | null;
  status: "requested" | "approved" | "filled" | "cancelled"; requested_by: string; decided_by: string | null; created_at: string;
  kind?: "permanent" | "temporary"; roles?: TempRole[] | null; start_date?: string | null; end_date?: string | null; decision_note?: string | null;
};
const TONE = { requested: "amber", approved: "sky", filled: "green", cancelled: "zinc" } as const;
type Msg = { ok: boolean; message: string } | null;

const isTemp = (r: ManpowerRow) => r.kind === "temporary";
/** A temporary request is over once its last day has passed. */
const tempOver = (r: ManpowerRow, today: string) => isTemp(r) && !!r.end_date && r.end_date < today;

/** Branches ask for people. Permanent: admins approve (shown as "urgent" on the careers page), then mark filled.
 *  Temporary (festival rush): HR approves and lends named staff from other stores for fixed dates. */
export function Manpower({ me, admin, canLend, rows, branches, posts, loans, today, tempReady }: {
  me: Profile; admin: boolean; canLend: boolean; rows: ManpowerRow[]; branches: Branch[]; posts: Record<string, string[]>;
  loans: StaffLoan[]; today: string; tempReady: boolean;
}) {
  const [kind, setKind] = useState<"permanent" | "temporary">("permanent");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const [assigning, setAssigning] = useState<ManpowerRow | null>(null);
  const bName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";
  const loansOf = (id: string) => loans.filter((l) => l.request_id === id);
  const open = rows.filter((r) => (r.status === "requested" || r.status === "approved" || (isTemp(r) && r.status === "filled")) && !tempOver(r, today));
  const closed = rows.filter((r) => !open.includes(r));
  // Stores see staff lent out by them too, so they know who is away.
  const lentOut = me.role === "branch" ? loans.filter((l) => l.from_branch_id === me.branch_id && loanState(l, today) !== "back") : [];

  const act = (fn: () => Promise<Msg>) => start(async () => setMsg(await fn()));

  const table = (list: ManpowerRow[]) => (
    <table className="w-full text-sm">
      <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-1.5">Branch</th><th>Post</th><th>People</th><th>When</th><th>Status</th><th>Asked by</th><th /></tr></thead>
      <tbody>{list.map((r) => {
        const temp = isTemp(r);
        const mine = loansOf(r.id);
        const over = tempOver(r, today);
        return (
          <tr key={r.id} className="border-b align-top last:border-0">
            <td className="py-1.5">{bName(r.branch_id)}</td>
            <td>
              {temp && <Badge tone="purple">Temporary</Badge>} {temp && r.roles
                ? <ul className="mt-0.5">{r.roles.map((x) => <li key={x.post}>{x.headcount} × {x.post}</li>)}</ul>
                : r.post}
              {r.reason && <div className="text-xs text-slate-500">{r.reason}</div>}
              {r.decision_note && <div className="text-xs text-slate-500">HR: {r.decision_note}</div>}
              {temp && mine.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {mine.map((l) => (
                    <li key={l.id}>
                      <span className="font-semibold">{l.name}</span> ({l.post}) from {bName(l.from_branch_id)}
                      {l.returned_on && <span className="text-slate-500"> · back after {formatDate(l.returned_on)}</span>}
                      {l.start_date > (r.start_date ?? "") && <span className="text-slate-500"> · from {formatDate(l.start_date)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </td>
            <td className="tabular-nums">{temp ? `${mine.length}/${r.headcount}` : r.headcount}</td>
            <td className="whitespace-nowrap">{temp ? <>{formatDate(r.start_date ?? null)}<br />to {formatDate(r.end_date ?? null)}</> : formatDate(r.needed_by)}</td>
            <td>{over && r.status !== "cancelled" ? <Badge tone="zinc">over</Badge> : <Badge tone={TONE[r.status]}>{temp && r.status === "filled" ? "sent" : r.status}</Badge>}</td>
            <td className="text-xs">{r.requested_by}<br />{formatDate(r.created_at)}</td>
            <td className="space-x-1 whitespace-nowrap text-right">
              {!temp && admin && r.status === "requested" && <button className="btn-success !py-0.5 text-xs" disabled={pending} onClick={() => act(() => setManpowerStatus(r.id, "approved"))}>Approve</button>}
              {!temp && admin && r.status === "approved" && <button className="btn-success !py-0.5 text-xs" disabled={pending} onClick={() => act(() => setManpowerStatus(r.id, "filled"))}>Filled</button>}
              {temp && canLend && r.status === "requested" && <>
                <button className="btn-success !py-0.5 text-xs" disabled={pending} onClick={() => act(() => decideTempRequest(r.id, true, ""))}>Approve</button>
                <button className="btn-outline !py-0.5 text-xs" disabled={pending} onClick={() => {
                  const note = window.prompt("Why is this request not approved? The store will see this.");
                  if (note !== null) act(() => decideTempRequest(r.id, false, note));
                }}>Decline</button>
              </>}
              {temp && canLend && (r.status === "approved" || r.status === "filled") && !over &&
                <button className="btn-primary !py-0.5 text-xs" disabled={pending} onClick={() => setAssigning(r)}>{r.status === "filled" ? "People" : "Pick people"}</button>}
              {(admin || (r.requested_by === me.username && r.status === "requested")) && (r.status === "requested" || (r.status === "approved" && !over)) &&
                <button className="btn-outline !py-0.5 text-xs" disabled={pending} onClick={() => act(() => setManpowerStatus(r.id, "cancelled"))}>Cancel</button>}
            </td>
          </tr>
        );
      })}</tbody>
    </table>
  );

  return (
    <div className="grid gap-4 px-4 sm:px-6 lg:grid-cols-3">
      <section className="card space-y-3 p-4 sm:p-5 lg:col-span-1">
        <h2 className="text-sm font-bold">Ask for staff</h2>
        <div className="flex gap-2" role="tablist" aria-label="Type of request">
          <button role="tab" aria-selected={kind === "permanent"} className={`chip ${kind === "permanent" ? "chip-on" : ""}`} onClick={() => setKind("permanent")}>Permanent</button>
          <button role="tab" aria-selected={kind === "temporary"} className={`chip ${kind === "temporary" ? "chip-on" : ""}`} onClick={() => setKind("temporary")}>Temporary</button>
        </div>
        <p className="-mt-1 text-xs text-slate-500">{kind === "permanent"
          ? "New hires. Approved requests show as “Urgently hiring” on the careers page."
          : "Festival rush: staff from other stores (automobile or jewellery) are lent to you for the dates you choose, then go back."}</p>
        <Flash msg={msg} />
        {kind === "permanent"
          ? <PermanentForm me={me} branches={branches} posts={posts} pending={pending} onSend={(f) => act(() => requestManpower(f))} />
          : tempReady
            ? <TemporaryForm me={me} branches={branches} posts={posts} today={today} pending={pending} onSend={(f) => act(() => requestTemporaryStaff(f))} />
            : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Temporary requests aren&apos;t set up yet. An admin needs to run 0021_temporary_staff.sql in Supabase.</p>}
      </section>
      <section className="card overflow-x-auto p-4 sm:p-5 lg:col-span-2">
        {lentOut.length > 0 && (
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
            <h2 className="mb-1 font-bold">Your staff lent to other stores</h2>
            <ul className="space-y-0.5">{lentOut.map((l) => (
              <li key={l.id}><span className="font-semibold">{l.name}</span> at {bName(l.to_branch_id)}, {formatDate(l.start_date)} to {formatDate(loanLastDay(l))}</li>
            ))}</ul>
          </div>
        )}
        <h2 className="mb-2 text-sm font-bold">Open ({open.length})</h2>
        {open.length ? table(open) : <p className="text-sm text-slate-500">No open requests.</p>}
        {closed.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">Closed ({closed.length})</summary>{table(closed)}</details>}
      </section>
      {assigning && (
        <AssignPeople request={assigning} loans={loansOf(assigning.id)} branches={branches} today={today}
          onClose={() => setAssigning(null)} onDone={(m) => { setMsg(m); if (m.ok) setAssigning(null); }} />
      )}
    </div>
  );
}

function BranchPicker({ me, branches, value, onChange }: { me: Profile; branches: Branch[]; value: string; onChange: (v: string) => void }) {
  if (me.role === "branch") return null;
  return (
    <Field label="Branch *">
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select --</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </Field>
  );
}

function PermanentForm({ me, branches, posts, pending, onSend }: {
  me: Profile; branches: Branch[]; posts: Record<string, string[]>; pending: boolean;
  onSend: (f: { branch_id: string; post: string; headcount: number; needed_by: string; reason: string }) => void;
}) {
  const [f, setF] = useState({ branch_id: me.role === "branch" ? me.branch_id ?? "" : "", post: "", headcount: 1, needed_by: "", reason: "" });
  return (
    <>
      <BranchPicker me={me} branches={branches} value={f.branch_id} onChange={(v) => setF({ ...f, branch_id: v, post: "" })} />
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
      <Field label="Reason (replacement, new counter…)"><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
      <button className="btn-primary" disabled={pending || !f.branch_id || !f.post} onClick={() => { onSend(f); setF({ ...f, post: "", headcount: 1, needed_by: "", reason: "" }); }}>Send request</button>
    </>
  );
}

function TemporaryForm({ me, branches, posts, today, pending, onSend }: {
  me: Profile; branches: Branch[]; posts: Record<string, string[]>; today: string; pending: boolean;
  onSend: (f: { branch_id: string; roles: TempRole[]; start_date: string; end_date: string; reason: string }) => void;
}) {
  const [branch, setBranch] = useState(me.role === "branch" ? me.branch_id ?? "" : "");
  const [roles, setRoles] = useState<TempRole[]>([{ post: "", headcount: 1 }]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  // Any role used at any store: a jewellery store may borrow from an automobile showroom and the other way round.
  const allPosts = useMemo(() => [...new Set(Object.values(posts).flat())].sort(), [posts]);
  const set = (i: number, patch: Partial<TempRole>) => setRoles(roles.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const ready = branch && from && to && to >= from && roles.some((r) => r.post.trim() && r.headcount >= 1);
  return (
    <>
      <BranchPicker me={me} branches={branches} value={branch} onChange={setBranch} />
      <datalist id="temp-posts">{allPosts.map((p) => <option key={p} value={p} />)}</datalist>
      <div className="space-y-2">
        <span className="label">Roles and number of people *</span>
        {roles.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input className="input min-w-0 flex-1" list="temp-posts" placeholder="Role, e.g. Sales Executive" aria-label={`Role ${i + 1}`}
              value={r.post} onChange={(e) => set(i, { post: e.target.value })} />
            <input className="input w-20" type="number" min={1} max={50} aria-label={`People for role ${i + 1}`}
              value={r.headcount} onChange={(e) => set(i, { headcount: Number(e.target.value) })} />
            {roles.length > 1 && <button className="btn-outline !px-2" aria-label={`Remove role ${i + 1}`} onClick={() => setRoles(roles.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        <button className="btn-outline !py-0.5 text-xs" onClick={() => setRoles([...roles, { post: "", headcount: 1 }])}>+ Add another role</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="From *"><input className="input" type="date" min={today} value={from} onChange={(e) => { setFrom(e.target.value); if (to && to < e.target.value) setTo(""); }} /></Field>
        <Field label="To (last day) *"><input className="input" type="date" min={from || today} max={from ? addDays(from, 120) : undefined} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <Field label="Reason (Diwali, Pongal, wedding season…)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <p className="text-xs text-slate-500">They go back automatically after the last day. If you need help for longer, send a new request.</p>
      <button className="btn-primary" disabled={pending || !ready} onClick={() => {
        onSend({ branch_id: branch, roles, start_date: from, end_date: to, reason });
        setRoles([{ post: "", headcount: 1 }]); setFrom(""); setTo(""); setReason("");
      }}>Send request</button>
    </>
  );
}

/** HR picks named staff from other stores for each role, and can take someone off the loan. */
function AssignPeople({ request, loans, branches, today, onClose, onDone }: {
  request: ManpowerRow; loans: StaffLoan[]; branches: Branch[]; today: string; onClose: () => void; onDone: (m: { ok: boolean; message: string }) => void;
}) {
  const roles = request.roles ?? [];
  const [pool, setPool] = useState<PoolPerson[] | null>(null);
  const [err, setErr] = useState<Msg>(null);
  const [picked, setPicked] = useState<Record<string, string>>({}); // employment_id -> role
  const [q, setQ] = useState("");
  const [business, setBusiness] = useState("");
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const need = stillNeeded(roles, loans);

  useEffect(() => {
    let live = true;
    loanPool(request.id).then((r) => { if (!live) return; setPool(r.people); if (!r.ok) setErr(r); });
    return () => { live = false; };
  }, [request.id, loans.length]);

  const assigned = new Set(loans.map((l) => l.employment_id));
  const needle = q.trim().toLowerCase();
  const list = (pool ?? []).filter((p) => !assigned.has(p.employment_id))
    .filter((p) => !business || byId.get(p.branch_id)?.business_type === business)
    .filter((p) => !needle || [p.name, p.designation, p.employee_code, byId.get(p.branch_id)?.name].some((v) => v?.toLowerCase().includes(needle)));
  const pickedFor = (post: string) => Object.values(picked).filter((v) => v === post).length;
  const types = [...new Set(branches.map((b) => b.business_type))].sort();

  return (
    <Modal open onClose={onClose} wide title={`Temporary staff for ${byId.get(request.branch_id)?.name ?? ""}`}
      subtitle={`${formatDate(request.start_date ?? null)} to ${formatDate(request.end_date ?? null)}${request.reason ? ` · ${request.reason}` : ""}`}>
      <Flash msg={err} />
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        {need.map((r) => {
          const left = r.headcount - pickedFor(r.post);
          return <Badge key={r.post} tone={left <= 0 ? "green" : "amber"}>{r.post}: {left <= 0 ? "all picked" : `${left} more needed`}</Badge>;
        })}
      </div>

      {loans.length > 0 && (
        <div className="mb-4">
          <h3 className="section-title mb-1">Already sent</h3>
          <ul className="divide-y text-sm">{loans.map((l) => {
            const state = loanState(l, today);
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span><span className="font-semibold">{l.name}</span> ({l.post}) from {byId.get(l.from_branch_id)?.name}
                  <span className="text-xs text-slate-500"> · {formatDate(l.start_date)} to {formatDate(loanLastDay(l))}{l.mobile && ` · ${l.mobile}`}</span></span>
                {state !== "back" && !l.returned_on && (
                  <button className="btn-outline !py-0.5 text-xs" disabled={pending} onClick={() => {
                    if (window.confirm(state === "upcoming" ? `Take ${l.name} off this loan? They stay at their own store.` : `Send ${l.name} back? Today is their last day here.`))
                      start(async () => onDone(await endStaffLoan(l.id)));
                  }}>{state === "upcoming" ? "Remove" : "Send back today"}</button>
                )}
              </li>
            );
          })}</ul>
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <input className="input min-w-0 flex-1" placeholder="Search name, role or store" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={business} onChange={(e) => setBusiness(e.target.value)} aria-label="Business">
          <option value="">All businesses</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="max-h-[45vh] overflow-y-auto">
        {pool === null ? <p className="p-2 text-sm text-slate-500">Loading staff…</p>
          : list.length === 0 ? <p className="p-2 text-sm text-slate-500">Nobody to pick. Staff appear here once they are in the staff register (Staff page).</p>
          : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-1.5">Name</th><th>Their role</th><th>Store</th><th>Send as</th></tr></thead>
              <tbody>{list.map((p) => (
                <tr key={p.employment_id} className="border-b align-top last:border-0">
                  <td className="py-1.5"><span className="font-semibold">{p.name}</span>{p.employee_code && <div className="text-xs text-slate-500">{p.employee_code}</div>}</td>
                  <td>{p.designation ?? "-"}</td>
                  <td>{byId.get(p.branch_id)?.name}
                    {p.busy?.map((b, i) => <div key={i} className="text-xs text-red-600">Lent to {byId.get(b.to_branch_id)?.name} {formatDate(b.start_date)}–{formatDate(b.end_date)}</div>)}
                  </td>
                  <td>
                    <select className="input !py-1" disabled={!!p.busy?.length} aria-label={`Send ${p.name} as`} value={picked[p.employment_id] ?? ""}
                      onChange={(e) => { const next = { ...picked }; if (e.target.value) next[p.employment_id] = e.target.value; else delete next[p.employment_id]; setPicked(next); }}>
                      <option value="">Not sending</option>
                      {need.filter((r) => r.headcount > 0).map((r) => <option key={r.post} value={r.post}>{r.post}</option>)}
                    </select>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Close</button>
        <button className="btn-primary" disabled={pending || Object.keys(picked).length === 0}
          onClick={() => start(async () => onDone(await assignTempStaff(request.id, Object.entries(picked).map(([employment_id, post]) => ({ employment_id, post })))))}>
          Send {Object.keys(picked).length || ""} {Object.keys(picked).length === 1 ? "person" : "people"}
        </button>
      </div>
    </Modal>
  );
}
