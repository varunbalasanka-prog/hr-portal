"use client";
import { useState, useTransition } from "react";
import { setStoreHr } from "@/app/actions/store-hr";
import { Badge, Flash } from "@/components/ui";
import type { Branch, Profile } from "@/lib/types";

/** Which HR looks after each store. One HR can have many stores; changing it also moves the store's candidates. */
export function StoreHrAdmin({ branches, people }: { branches: Branch[]; people: Profile[] }) {
  const hrs = people.filter((p) => p.role === "hr");
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const shown = filter ? branches.filter((b) => b.hr_username === filter) : branches;
  const towns = [...new Set(shown.map((b) => b.town))];
  const label = (u: string) => hrs.find((h) => h.username === u)?.full_name || u;

  const change = (b: Branch, hr: string) => {
    if (!hr || hr === b.hr_username) return;
    if (!confirm(`Give ${b.name} to ${label(hr)}?\n\nAll of its candidates move from ${label(b.hr_username)} to ${label(hr)}, and ${label(hr)} gets its new applications, walk-ins, staff and manpower from now on.`)) return;
    start(async () => setMsg(await setStoreHr(b.id, hr, "all")));
  };

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-bold">Which HR looks after each store</h2>
      <p className="mb-3 text-xs text-slate-500">
        The store&apos;s HR gets everything for that store: new applications, walk-ins, onboarding, staff records, appraisals,
        manpower and alerts. One HR can look after many stores.
      </p>
      <Flash msg={msg} />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <button onClick={() => setFilter("")} className={`rounded-full border px-3 py-1 ${!filter ? "border-brand bg-brand text-white" : "border-slate-300"}`}>All stores ({branches.length})</button>
        {hrs.map((h) => (
          <button key={h.username} onClick={() => setFilter(h.username)}
            className={`rounded-full border px-3 py-1 ${filter === h.username ? "border-brand bg-brand text-white" : "border-slate-300"}`}>
            {h.full_name || h.username} ({branches.filter((b) => b.hr_username === h.username).length})
          </button>
        ))}
      </div>
      {hrs.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No HR logins yet. Add one under Logins first.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">Store</th><th>HR</th></tr></thead>
          <tbody>
            {towns.map((t) => [
              <tr key={t}><td colSpan={2} className="bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">{t}</td></tr>,
              ...shown.filter((b) => b.town === t).map((b) => (
                <tr key={b.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3">{b.name} <Badge tone="slate">{b.business_type}</Badge></td>
                  <td className="py-1.5">
                    <select className="input max-w-[14rem]" value={b.hr_username} disabled={pending} onChange={(e) => change(b, e.target.value)}>
                      {!hrs.some((h) => h.username === b.hr_username) && <option value={b.hr_username}>{b.hr_username} (not an HR login)</option>}
                      {hrs.map((h) => <option key={h.username} value={h.username}>{h.full_name || h.username}</option>)}
                    </select>
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}
