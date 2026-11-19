"use client";
import { useState, useTransition } from "react";
import type { Candidate } from "@/lib/types";
import { CANDIDATE_FIELDS, CANDIDATE_FIELD_LABELS, STATUS_TARGETS, changedFields, onboardingKeys, reasonOk, type StatusTarget } from "@/lib/corrections";
import { DETAIL_LABELS } from "@/lib/onboarding";
import { correctCandidate, correctEmployee, correctOnboarding, correctStatus, undoLeaving } from "@/app/actions/corrections";
import { Field, Flash, Select } from "./ui";

type Msg = { ok: boolean; message: string } | null;

function Reason({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Reason for the correction *">
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. HR typed the wrong mobile number" />
    </Field>
  );
}

function Shell({ title, open, setOpen, msg, children }: { title: string; open: boolean; setOpen: (o: boolean) => void; msg: Msg; children: React.ReactNode }) {
  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-outline !py-1 text-xs" onClick={() => setOpen(true)}>✏️ {title}</button>
        <Flash msg={msg} />
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
      <div className="flex items-center gap-2"><b>{title}</b><span className="text-xs text-slate-600">(admin only, saved in Change history)</span></div>
      {children}
      <Flash msg={msg} />
    </div>
  );
}

/** Admin: correct the person's own details (name, mobile, email, address, father/husband, marital status). */
export function CorrectDetails({ c, onSaved }: { c: Candidate; onSaved: () => void }) {
  const before = Object.fromEntries(CANDIDATE_FIELDS.map((k) => [k, (c[k] as string | null) ?? ""]));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Record<string, string>>(before);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const changes = changedFields(before, f);
  return (
    <Shell title="Correct details" open={open} setOpen={setOpen} msg={msg}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CANDIDATE_FIELDS.map((k) => (
          <Field key={k} label={CANDIDATE_FIELD_LABELS[k]}>
            {k === "marital_status"
              ? <Select value={f[k]} onChange={(v) => setF((p) => ({ ...p, [k]: v }))} options={[...new Set(["Unmarried", "Married", ...(f[k] ? [f[k]] : [])])]} />
              : k === "address"
              ? <textarea className="input" rows={2} value={f[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} />
              : <input className="input" inputMode={k === "mobile" ? "numeric" : undefined} value={f[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} />}
          </Field>
        ))}
      </div>
      {"mobile" in changes && <p className="text-xs text-amber-800">Changing the mobile also changes where WhatsApp messages and calls go.</p>}
      <Reason value={reason} onChange={setReason} />
      <div className="flex gap-2">
        <button className="btn-success" disabled={pending || !Object.keys(changes).length || !reasonOk(reason)} onClick={() => start(async () => {
          const r = await correctCandidate(c.id, changes, reason); setMsg(r);
          if (r.ok) { setOpen(false); setReason(""); onSaved(); }
        })}>Save correction</button>
        <button className="btn-outline" disabled={pending} onClick={() => { setF(before); setReason(""); setOpen(false); }}>Cancel</button>
      </div>
    </Shell>
  );
}

/** Admin: correct the typed details of the onboarding form. Documents still go back to the candidate. */
export function CorrectOnboarding({ candidateId, details, onSaved }: { candidateId: string; details: Record<string, unknown>; onSaved: () => void }) {
  const keys = onboardingKeys(details, Object.keys(DETAIL_LABELS));
  const before = Object.fromEntries(keys.map((k) => [k, details[k] == null ? "" : String(details[k])]));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Record<string, string>>(before);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const changes = changedFields(before, f);
  return (
    <Shell title="Correct onboarding details" open={open} setOpen={setOpen} msg={msg}>
      <p className="text-xs text-slate-600">Typed details only. For a wrong or missing document, tick it above and send it back to the candidate. Clearing a box removes that detail.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {keys.map((k) => (
          <Field key={k} label={(DETAIL_LABELS[k] ?? k.replace(/_/g, " ")).split(" / ")[0]}>
            <input className="input" value={f[k] ?? ""} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} />
          </Field>
        ))}
      </div>
      <Reason value={reason} onChange={setReason} />
      <div className="flex gap-2">
        <button className="btn-success" disabled={pending || !Object.keys(changes).length || !reasonOk(reason)} onClick={() => start(async () => {
          const r = await correctOnboarding(candidateId, changes, reason); setMsg(r);
          if (r.ok) { setOpen(false); setReason(""); onSaved(); }
        })}>Save correction</button>
        <button className="btn-outline" disabled={pending} onClick={() => { setF(before); setReason(""); setOpen(false); }}>Cancel</button>
      </div>
    </Shell>
  );
}

/** Admin: put the candidate back to the right stage (e.g. marked "Not attended" or "Joined" by mistake). */
export function CorrectStatus({ c, onSaved }: { c: Candidate; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<StatusTarget | "">("");
  const [at, setAt] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const t = STATUS_TARGETS.find((x) => x.value === target);
  const ready = !!t && reasonOk(reason) && (t.needs !== "at" || !!at) && (t.needs !== "date" || !!date);
  return (
    <Shell title="Correct status" open={open} setOpen={setOpen} msg={msg}>
      <p className="text-xs text-slate-600">Now: <b>{c.pipeline_status}</b>. Answers saved after the stage you pick are cleared so the forms start fresh; the old values stay in History and Change history.</p>
      <Field label="Correct status *">
        <Select value={target} onChange={(v) => setTarget(v as StatusTarget)} options={STATUS_TARGETS.map((x) => ({ value: x.value, label: x.label }))} />
      </Field>
      {t?.needs === "at" && <Field label={`${t.dateLabel} *`}><input type="datetime-local" className="input" value={at} onChange={(e) => setAt(e.target.value)} /></Field>}
      {t?.needs === "date" && <Field label={`${t.dateLabel} *`}><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
      <Reason value={reason} onChange={setReason} />
      <div className="flex gap-2">
        <button className="btn-success" disabled={pending || !ready} onClick={() => start(async () => {
          const r = await correctStatus(c.id, target as StatusTarget, at, date, reason); setMsg(r);
          if (r.ok) { setOpen(false); setReason(""); setTarget(""); onSaved(); }
        })}>Save status</button>
        <button className="btn-outline" disabled={pending} onClick={() => { setReason(""); setTarget(""); setOpen(false); }}>Cancel</button>
      </div>
    </Shell>
  );
}

/** Admin, Staff page: correct an imported staff member's name / mobile, or undo a leaving done by mistake. */
export function CorrectStaff({ employeeId, employmentId, name, mobile, left, onSaved }: {
  employeeId: string; employmentId: string; name: string; mobile: string | null; left: boolean; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(name);
  const [m, setM] = useState(mobile ?? "");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const changed = n.trim() !== name || m.trim() !== (mobile ?? "");
  return (
    <Shell title="Correct details" open={open} setOpen={setOpen} msg={msg}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={n} onChange={(e) => setN(e.target.value)} /></Field>
        <Field label="Mobile"><input className="input" inputMode="numeric" value={m} onChange={(e) => setM(e.target.value)} /></Field>
      </div>
      <Reason value={reason} onChange={setReason} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-success" disabled={pending || !changed || !reasonOk(reason)} onClick={() => start(async () => {
          const r = await correctEmployee(employeeId, n, m, reason); setMsg(r);
          if (r.ok) { setOpen(false); setReason(""); onSaved(); }
        })}>Save correction</button>
        {left && (
          <button className="btn-outline" disabled={pending || !reasonOk(reason)} title="Relieved by mistake: back to working" onClick={() => start(async () => {
            if (!confirm(`Mark ${name} as still working? The leaving date and exit are cancelled.`)) return;
            const r = await undoLeaving(employmentId, reason); setMsg(r);
            if (r.ok) { setOpen(false); setReason(""); onSaved(); }
          })}>Undo leaving (still working)</button>
        )}
        <button className="btn-outline" disabled={pending} onClick={() => { setN(name); setM(mobile ?? ""); setReason(""); setOpen(false); }}>Cancel</button>
      </div>
    </Shell>
  );
}
