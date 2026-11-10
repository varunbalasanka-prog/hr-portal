"use client";
import { useState, useTransition } from "react";
import { addStore, deleteStore, setStoreClosed, updateStore, type StoreInput } from "@/app/actions/stores";
import { Badge, Flash, Modal } from "@/components/ui";
import { divisionOf } from "@/lib/staff";
import type { Branch, Profile } from "@/lib/types";

export type StoreUsage = { branch_id: string; candidates: number; staff: number; logins: number; requests: number };

const BLANK: StoreInput = { brand: "", town: "", division: "", business_type: "", hr_username: "", address: "", street_address: "", postal_code: "" };

/**
 * Add a store, edit its details, close or reopen it, or delete it.
 * Close keeps every record and can be undone; Delete only works for a store nothing points to (e.g. added by mistake).
 */
export function StoresAdmin({ branches, people, usage }: { branches: Branch[]; people: Profile[]; usage: StoreUsage[] | null }) {
  const hrs = people.filter((p) => p.role === "hr");
  const types = [...new Set(branches.map((b) => b.business_type))].sort();
  const firms = [...new Set(branches.map((b) => divisionOf(b)))].sort();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const closed = branches.filter((b) => b.closed_at);
  const shown = branches.filter((b) => showClosed || !b.closed_at);
  const towns = [...new Set(shown.map((b) => b.town))].sort();
  const use = (id: string) => usage?.find((u) => u.branch_id === id);
  const empty = (id: string) => { const u = use(id); return !!u && u.candidates + u.staff + u.logins + u.requests === 0; };

  if (usage === null) {
    return <section className="card p-4 text-sm text-slate-600">This tab needs the database update <b>0037_admin_designation_and_stores.sql</b>. Run it in Supabase, then reload.</section>;
  }

  const close = (b: Branch) => {
    if (!confirm(`Close ${b.name}?\n\n• It disappears from the apply page, careers, job listings and the store pickers.\n• Its open manpower requests are closed.\n• All its candidates, staff records and history are kept.\n\nYou can reopen it later.`)) return;
    start(async () => setMsg(await setStoreClosed(b.id, true)));
  };
  const reopen = (b: Branch) => start(async () => setMsg(await setStoreClosed(b.id, false)));
  const remove = (b: Branch) => {
    if (!confirm(`Delete ${b.name} for good?\n\nThis cannot be undone.`)) return;
    start(async () => setMsg(await deleteStore(b.id)));
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold">Stores</h2>
        <button className="btn-primary ml-auto" onClick={() => { setMsg(null); setAdding(true); }}>+ Add store</button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        <b>Close</b> hides a store for new work and keeps all its records; you can reopen it. <b>Delete</b> is only for a store
        with nothing recorded against it, such as one added by mistake.
      </p>
      <Flash msg={msg} />
      {closed.length > 0 && (
        <label className="mb-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show closed stores ({closed.length})</label>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">Store</th><th>HR</th><th>Records</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {towns.map((t) => [
              <tr key={t}><td colSpan={4} className="bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">{t}</td></tr>,
              ...shown.filter((b) => b.town === t).map((b) => {
                const u = use(b.id);
                return (
                  <tr key={b.id} className={`border-b border-slate-100 align-top ${b.closed_at ? "text-slate-400" : ""}`}>
                    <td className="py-1.5 pr-3">
                      {b.name} <Badge tone="slate">{b.business_type}</Badge> {b.closed_at && <Badge tone="red">Closed</Badge>}
                    </td>
                    <td className="py-1.5 pr-3 text-xs">{hrs.find((h) => h.username === b.hr_username)?.full_name || b.hr_username}</td>
                    <td className="py-1.5 pr-3 text-xs text-slate-500">
                      {u ? [u.candidates && `${u.candidates} candidates`, u.staff && `${u.staff} staff`, u.logins && `${u.logins} login`, u.requests && `${u.requests} requests`].filter(Boolean).join(", ") || "none" : "-"}
                    </td>
                    <td className="whitespace-nowrap py-1.5 text-right">
                      <button className="btn-ghost" disabled={pending} onClick={() => { setMsg(null); setEditing(b); }}>Edit</button>
                      {b.closed_at
                        ? <button className="btn-outline" disabled={pending} onClick={() => reopen(b)}>Reopen</button>
                        : <button className="btn-outline" disabled={pending} onClick={() => close(b)}>Close</button>}
                      {empty(b.id) && <button className="btn-danger ml-1" disabled={pending} onClick={() => remove(b)}>Delete</button>}
                    </td>
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
      </div>
      {adding && <AddStore types={types} firms={firms} hrs={hrs} onClose={() => setAdding(false)} onDone={(r) => { setMsg(r); if (r.ok) setAdding(false); }} />}
      {editing && <EditStore b={editing} types={types} onClose={() => setEditing(null)} onDone={(r) => { setMsg(r); if (r.ok) setEditing(null); }} />}
    </section>
  );
}

function TypeField({ value, types, onChange }: { value: string; types: string[]; onChange: (v: string) => void }) {
  const other = value !== "" && !types.includes(value);
  return (
    <label className="block"><span className="label">Business type *</span>
      <select className="input" value={other ? "__other" : value} onChange={(e) => onChange(e.target.value === "__other" ? " " : e.target.value)}>
        <option value="">-- Select --</option>
        {types.map((t) => <option key={t}>{t}</option>)}
        <option value="__other">Other (type it)</option>
      </select>
      {other && <input className="input mt-1" placeholder="Business type" value={value.trim()} onChange={(e) => onChange(e.target.value || " ")} />}
    </label>
  );
}

function AddressFields({ f, set }: { f: Pick<StoreInput, "address" | "street_address" | "postal_code">; set: (k: "address" | "street_address" | "postal_code", v: string) => void }) {
  return (
    <>
      <label className="block sm:col-span-2"><span className="label">Company name &amp; address (for letters)</span>
        <textarea className="input" rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} />
      </label>
      <label className="block"><span className="label">Street address (for Google job listings)</span>
        <input className="input" value={f.street_address} onChange={(e) => set("street_address", e.target.value)} />
      </label>
      <label className="block"><span className="label">PIN code</span>
        <input className="input" inputMode="numeric" maxLength={6} value={f.postal_code} onChange={(e) => set("postal_code", e.target.value.replace(/\D/g, ""))} />
      </label>
    </>
  );
}

function AddStore({ types, firms, hrs, onClose, onDone }: { types: string[]; firms: string[]; hrs: Profile[]; onClose: () => void; onDone: (r: { ok: boolean; message: string }) => void }) {
  const [f, setF] = useState<StoreInput>(BLANK);
  const [pending, start] = useTransition();
  const set = (k: keyof StoreInput, v: string) => setF((p) => ({ ...p, [k]: v }));
  const name = f.brand.trim() && f.town.trim() ? `${f.brand.trim()} - ${f.town.trim()}` : "";
  return (
    <Modal open onClose={onClose} wide title="Add a store" subtitle={name ? <>Will be saved as <b>{name}</b></> : "Name is Brand - Town, e.g. Tanishq - Theni"}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Brand *</span><input className="input" value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. Tanishq" /></label>
        <label className="block"><span className="label">Town *</span><input className="input" value={f.town} onChange={(e) => set("town", e.target.value)} placeholder="e.g. Theni" /></label>
        <TypeField value={f.business_type} types={types} onChange={(v) => set("business_type", v)} />
        <label className="block"><span className="label">Firm (shares job roles with)</span>
          <select className="input" value={f.division} onChange={(e) => set("division", e.target.value)}>
            <option value="">New firm, named after the brand</option>
            {firms.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">HR who looks after it *</span>
          <select className="input" value={f.hr_username} onChange={(e) => set("hr_username", e.target.value)}>
            <option value="">-- Select --</option>
            {hrs.map((h) => <option key={h.username} value={h.username}>{h.full_name || h.username}</option>)}
          </select>
        </label>
        <span />
        <AddressFields f={f} set={set} />
      </div>
      <p className="mt-3 text-xs text-slate-500">The store name can&apos;t be changed later, because applications and staff records refer to it. After adding: open its posts under <b>Store posts</b> and add its login under <b>Logins</b>. If it has no firm yet, give the firm its roles under <b>Job roles</b>.</p>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" disabled={pending || !name} onClick={() => start(async () => onDone(await addStore(f)))}>{pending ? "Adding…" : "Add store"}</button>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

function EditStore({ b, types, onClose, onDone }: { b: Branch; types: string[]; onClose: () => void; onDone: (r: { ok: boolean; message: string }) => void }) {
  const [f, setF] = useState({ town: b.town, business_type: b.business_type, address: b.address ?? "", street_address: b.street_address ?? "", postal_code: b.postal_code ?? "" });
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal open onClose={onClose} wide title={`Edit ${b.name}`} subtitle="The name stays the same. HR is changed under Store HR, the firm under Staff > Divisions.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Town *</span><input className="input" value={f.town} onChange={(e) => set("town", e.target.value)} /></label>
        <TypeField value={f.business_type} types={types} onChange={(v) => set("business_type", v)} />
        <AddressFields f={f} set={set} />
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" disabled={pending} onClick={() => start(async () => onDone(await updateStore(b.id, f)))}>{pending ? "Saving…" : "Save"}</button>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
