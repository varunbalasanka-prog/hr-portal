"use client";
import { useState, useTransition } from "react";
import { roleOptions } from "@/lib/job-roles";
import { todayIst } from "@/lib/dates";
import { Flash } from "./ui";

type Result = { ok: boolean; message: string };

const KINDS: [string, string][] = [
  ["role change", "Role change"], ["promotion", "Promotion"], ["demotion", "Demotion"], ["correction", "Correction (it was entered wrong)"],
];

/**
 * Admin-only: change someone's designation. For working staff the change is dated, so the staff record keeps the old
 * designation up to the day before. A correction just fixes the current line. Not-yet-joined people get the new value.
 */
export function DesignationBox({ current, roles, working, left, onSave, onSaved }: {
  current: string | null;
  roles?: string[];
  /** Working staff: ask what kind of change and from when. */
  working: boolean;
  /** Left: only a correction of the last designation. */
  left?: boolean;
  onSave: (designation: string, kind: string, from: string, reason: string) => Promise<Result>;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current ?? "");
  const [kind, setKind] = useState(left ? "correction" : "role change");
  const [from, setFrom] = useState(todayIst());
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const options = roles?.length ? roleOptions(roles, current) : null;

  if (!open) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded border border-slate-200 p-3 text-sm">
        <span><b>Designation:</b> {current ?? "-"}</span>
        <button className="btn-outline ml-auto" onClick={() => setOpen(true)}>Change designation</button>
        <Flash msg={msg} />
      </div>
    );
  }
  const save = () => start(async () => {
    const r = await onSave(value, kind, kind === "correction" ? "" : from, reason);
    setMsg(r);
    if (r.ok) { setOpen(false); onSaved(); }
  });
  return (
    <div className="mt-4 space-y-2 rounded border border-slate-200 p-3 text-sm">
      <b>Change designation</b> <span className="text-xs text-slate-500">(admin only)</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block"><span className="label">New designation</span>
          {options
            ? <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="">-- Select --</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            : <input className="input" value={value} onChange={(e) => setValue(e.target.value)} />}
        </label>
        {working && !left && (
          <label className="block"><span className="label">What kind of change</span>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        )}
        {working && !left && kind !== "correction" && (
          <label className="block"><span className="label">Starts from</span>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
        )}
        {working && (
          <label className="block"><span className="label">Reason (optional)</span>
            <input className="input" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </label>
        )}
      </div>
      {working && !left && (
        <p className="text-xs text-slate-500">
          {kind === "correction"
            ? "Fixes the current designation in the staff record. No new line is added."
            : "The staff record keeps the old designation up to the day before the start date, and shows the new one from then."}
          {" "}Salary stays the same; change pay through an appraisal.
        </p>
      )}
      {left && <p className="text-xs text-slate-500">This person has left, so this corrects their last designation in the staff record.</p>}
      <Flash msg={msg} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending || !value.trim() || value.trim() === (current ?? "")} onClick={save}>{pending ? "Saving…" : "Save"}</button>
        <button className="btn-outline" disabled={pending} onClick={() => { setOpen(false); setValue(current ?? ""); setMsg(null); }}>Cancel</button>
      </div>
    </div>
  );
}
