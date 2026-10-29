"use client";
import { useState, useTransition } from "react";
import { saveOpenings, saveRole, saveStoreAddress, type OpeningInput } from "@/app/actions/jobs";
import { Badge, Flash } from "@/components/ui";
import { formatDate } from "@/lib/dates";

export type OpeningRow = { id: string; branch_id: string; post: string; opened_at: string; closes_on: string | null; salary_min: number | null; salary_max: number | null };
export type RoleRow = { name: string; summary: string; duties: string; requirements: string; shift: string; benefits: string };
type Store = { id: string; name: string; town: string; business_type: string; address: string | null; street_address?: string | null; postal_code?: string | null };
type Msg = { ok: boolean; message: string } | null;

const num = (s: string) => (s.trim() ? Number(s.replace(/[^\d]/g, "")) : null);

/**
 * What Google for Jobs shows for each open post: closing date and salary per store,
 * the store's street and PIN, and the description of each post. Which posts are open
 * is still set in "Store posts"; ticking a post there opens a job here.
 */
export function JobListingsAdmin({ ready, branches, openings, roles, posts }: { ready: boolean; branches: Store[]; openings: OpeningRow[]; roles: RoleRow[]; posts: string[] }) {
  const [view, setView] = useState<"stores" | "roles">("stores");
  if (!ready) return <section className="card p-4 text-sm">Job listings need the database update 0024_job_listings.sql. Run it in Supabase, then reload this page.</section>;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className={view === "stores" ? "btn-primary" : "btn-outline"} onClick={() => setView("stores")}>Jobs at each store</button>
        <button className={view === "roles" ? "btn-primary" : "btn-outline"} onClick={() => setView("roles")}>Post descriptions</button>
      </div>
      {view === "stores" ? <StoreJobs branches={branches} openings={openings} /> : <RoleEditor roles={roles} posts={posts} />}
    </div>
  );
}

function StoreJobs({ branches, openings }: { branches: Store[]; openings: OpeningRow[] }) {
  const [selected, setSelected] = useState(branches[0]?.id ?? "");
  const towns = [...new Set(branches.map((b) => b.town))];
  const branch = branches.find((b) => b.id === selected);
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-bold">Jobs at each store</h2>
      <p className="mb-2 text-xs text-slate-500">
        Each ticked post is its own job page on the careers site and in Google. Set the last date to apply and the monthly salary.
        After the last date the job disappears from Google. New jobs close 30 days after they open unless you change it.
      </p>
      <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
        <ul className="max-h-[32rem] overflow-y-auto rounded border border-slate-200 text-sm">
          {towns.map((t) => (
            <li key={t}>
              <div className="bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">{t}</div>
              {branches.filter((b) => b.town === t).map((b) => {
                const n = openings.filter((o) => o.branch_id === b.id).length;
                const noAddress = !b.street_address || !b.postal_code;
                return (
                  <button key={b.id} onClick={() => setSelected(b.id)}
                    className={`flex w-full items-center justify-between gap-1 px-2 py-1.5 text-left hover:bg-sky-50 ${b.id === selected ? "bg-sky-100 font-semibold" : ""}`}>
                    <span>{b.name}</span>
                    <span className="flex gap-1">{noAddress && <Badge tone="amber">address</Badge>}{n ? <Badge tone="green">{n}</Badge> : <Badge tone="slate">0</Badge>}</span>
                  </button>
                );
              })}
            </li>
          ))}
        </ul>
        {branch && <StorePanel key={branch.id} branch={branch} openings={openings.filter((o) => o.branch_id === branch.id)} />}
      </div>
    </section>
  );
}

function StorePanel({ branch, openings }: { branch: Store; openings: OpeningRow[] }) {
  const [street, setStreet] = useState(branch.street_address ?? "");
  const [pin, setPin] = useState(branch.postal_code ?? "");
  const [rows, setRows] = useState(() => openings.map((o) => ({ id: o.id, post: o.post, opened_at: o.opened_at, closes_on: o.closes_on ?? "", lo: o.salary_min?.toString() ?? "", hi: o.salary_max?.toString() ?? "" })));
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const edit = (id: string, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const fillAll = (patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r) => ({ ...r, ...patch })));
  const saveJobs = () => start(async () => {
    const input: OpeningInput[] = rows.map((r) => ({ id: r.id, closes_on: r.closes_on || null, salary_min: num(r.lo), salary_max: num(r.hi) }));
    setMsg(await saveOpenings(input));
  });
  const first = rows[0];

  return (
    <div className="space-y-4">
      <Flash msg={msg} />
      <div>
        <div className="mb-2"><b>{branch.name}</b> <Badge tone="slate">{branch.business_type}</Badge></div>
        {branch.address && <p className="mb-2 text-xs text-slate-500">Address on file: {branch.address}</p>}
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
          <label><span className="label">Street (door number, building, road)</span><input className="input" value={street} onChange={(e) => setStreet(e.target.value)} /></label>
          <label><span className="label">PIN code</span><input className="input" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label>
          <button className="btn-outline" disabled={pending} onClick={() => start(async () => setMsg(await saveStoreAddress(branch.id, street, pin)))}>Save address</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No posts are open at this store. Tick posts in &ldquo;Store posts&rdquo; to open jobs here.</p>
      ) : (
        <div>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="py-1 pr-2">Post</th><th className="pr-2">Posted</th><th className="pr-2">Last date to apply</th><th className="pr-2">Salary from (₹/month)</th><th>Salary to</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-1 pr-2 font-medium">{r.post}</td>
                    <td className="whitespace-nowrap pr-2 text-xs text-slate-500">{formatDate(r.opened_at)}</td>
                    <td className="pr-2"><input type="date" className="input py-1" value={r.closes_on} onChange={(e) => edit(r.id, { closes_on: e.target.value })} /></td>
                    <td className="pr-2"><input className="input w-28 py-1" inputMode="numeric" value={r.lo} onChange={(e) => edit(r.id, { lo: e.target.value })} /></td>
                    <td><input className="input w-28 py-1" inputMode="numeric" value={r.hi} onChange={(e) => edit(r.id, { hi: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={pending} onClick={saveJobs}>{pending ? "Saving…" : "Save jobs"}</button>
            {first && rows.length > 1 && (
              <button className="btn-outline" disabled={pending} onClick={() => fillAll({ closes_on: first.closes_on })}>Use the first last-date for all</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY: RoleRow = { name: "", summary: "", duties: "", requirements: "", shift: "", benefits: "" };

function RoleEditor({ roles, posts }: { roles: RoleRow[]; posts: string[] }) {
  const names = [...new Set([...posts, ...roles.map((r) => r.name)])];
  const find = (n: string) => roles.find((r) => r.name === n) ?? { ...EMPTY, name: n };
  const [form, setForm] = useState<RoleRow>(find(names[0] ?? ""));
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof RoleRow) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const area = (k: keyof RoleRow, label: string, hint: string) => (
    <label className="block"><span className="label">{label} <span className="font-normal text-slate-400">{hint}</span></span>
      <textarea className="input min-h-28" value={form[k]} onChange={set(k)} /></label>
  );
  return (
    <section className="card space-y-3 p-4 sm:p-5">
      <div>
        <h2 className="mb-1 text-sm font-bold">Post descriptions</h2>
        <p className="text-xs text-slate-500">Shown on every job page for this post, at every store, and sent to Google. Write it the way you&apos;d explain the job to a candidate.</p>
      </div>
      <Flash msg={msg} />
      <label className="block max-w-sm"><span className="label">Post</span>
        <select className="input" value={form.name} onChange={(e) => { setForm(find(e.target.value)); setMsg(null); }}>
          {names.map((n) => <option key={n}>{n}</option>)}
        </select>
      </label>
      <label className="block"><span className="label">Summary <span className="font-normal text-slate-400">one or two sentences</span></span>
        <input className="input" value={form.summary} onChange={set("summary")} /></label>
      {area("duties", "Duties", "one per line")}
      {area("requirements", "Requirements", "one per line")}
      <label className="block"><span className="label">Working hours <span className="font-normal text-slate-400">e.g. 9:30 am to 8:30 pm, one weekly off</span></span>
        <input className="input" value={form.shift} onChange={set("shift")} /></label>
      {area("benefits", "Benefits", "one per line")}
      <button className="btn-primary" disabled={pending || !form.name} onClick={() => start(async () => setMsg(await saveRole(form)))}>{pending ? "Saving…" : "Save description"}</button>
    </section>
  );
}
