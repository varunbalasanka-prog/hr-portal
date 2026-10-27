"use client";
import { useState, useTransition } from "react";
import { decideAppraisal, proposeAppraisal, saveAppraisalInterview } from "@/app/actions/appraisals";
import { GRADES, STATUS_LABEL, answerKey, cycleFor, interviewGaps, pastYears, risePct, type Answers, type Appraisal, type AppraisalField, type AppraisalForm, type AppraisalSection } from "@/lib/appraisal";
import { formatDate } from "@/lib/dates";
import type { StaffStint } from "@/lib/staff";
import { Badge, Flash, Modal } from "@/components/ui";

const money = (n: number | null) => (n == null ? "-" : `₹${Number(n).toLocaleString("en-IN")}`);
const TONE = { interviewed: "sky", proposed: "amber", approved: "green", rejected: "zinc" } as const;

/** What the appraisal sheet is showing: an existing appraisal, or a new interview for someone. */
export type SheetTarget = { appraisal: Appraisal; stint: StaffStint } | { appraisal: null; stint: StaffStint; form: AppraisalForm; cycle: string };

/** The appraisals block inside a person's timeline. */
export function AppraisalsBlock({ s, list, form, today, onOpen }: {
  s: StaffStint; list: Appraisal[]; form: AppraisalForm | null; today: string; onOpen: (t: SheetTarget) => void;
}) {
  const cycle = cycleFor(today);
  const mine = list.filter((a) => a.employment_id === s.id);
  const canStart = !s.left_on && form && !mine.some((a) => a.cycle === cycle && a.status !== "rejected");
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title">Appraisals</h3>
        {canStart && <button className="btn-outline !py-1 text-sm" onClick={() => onOpen({ appraisal: null, stint: s, form: form!, cycle })}>Start {cycle} interview</button>}
      </div>
      {mine.length === 0 && (
        <p className="text-sm text-slate-500">
          {form ? "None yet. Pay rises and promotions after the first month go through an appraisal interview."
            : s.left_on ? "None." : "This store has no appraisal form yet, so its salaries change the old way."}
        </p>
      )}
      <ul className="space-y-1.5">
        {mine.map((a) => (
          <li key={a.id}>
            <button className="flex w-full flex-wrap items-center gap-2 rounded-lg border p-2 text-left text-sm hover:bg-slate-50" onClick={() => onOpen({ appraisal: a, stint: s })}>
              <span className="font-semibold">{a.cycle}</span>
              <Badge tone={TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
              {a.proposed_basic != null && <span className="text-slate-600">{money(a.current_basic)} → {money(a.proposed_basic)}{risePct(a) != null && ` (${risePct(a)}%)`}</span>}
              {a.interview_on && <span className="text-xs text-slate-500">interview {formatDate(a.interview_on)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Admin list of appraisals waiting for a decision. */
export function PendingAppraisals({ list, stints, bName, onOpen }: {
  list: Appraisal[]; stints: StaffStint[]; bName: (s: StaffStint) => string; onOpen: (t: SheetTarget) => void;
}) {
  const byId = new Map(stints.map((s) => [s.id, s]));
  const waiting = list.filter((a) => a.status === "proposed" && byId.has(a.employment_id));
  if (waiting.length === 0) return null;
  return (
    <div className="card border-amber-200 bg-amber-50/50 p-3">
      <div className="section-title mb-2">Appraisals waiting for your approval ({waiting.length})</div>
      <ul className="divide-y text-sm">
        {waiting.map((a) => {
          const s = byId.get(a.employment_id)!;
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
              <button className="font-semibold hover:underline" onClick={() => onOpen({ appraisal: a, stint: s })}>{s.name}</button>
              <span className="text-slate-600">{bName(s)}</span>
              <span>{money(a.current_basic)} → {money(a.proposed_basic)}{risePct(a) != null && ` (${risePct(a)}%)`}</span>
              {a.proposed_designation && a.proposed_designation !== a.current_designation && <Badge tone="purple">Promotion: {a.proposed_designation}</Badge>}
              <span className="text-xs text-slate-500">from {formatDate(a.effective_from)} · by {a.proposed_by}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The interview form, the proposal and the admin's decision, in one sheet. */
export function AppraisalSheet({ target, admin, today, onClose }: { target: SheetTarget | null; admin: boolean; today: string; onClose: () => void }) {
  return (
    <Modal open={!!target} onClose={onClose} wide title={target ? `${target.stint.name}: appraisal ${target.appraisal?.cycle ?? (target as { cycle: string }).cycle}` : ""}
      subtitle={target && (target.appraisal ? STATUS_LABEL[target.appraisal.status] : "New interview")}>
      {target && <SheetBody key={target.appraisal?.id ?? "new"} target={target} admin={admin} today={today} onClose={onClose} />}
    </Modal>
  );
}

function SheetBody({ target, admin, today, onClose }: { target: SheetTarget; admin: boolean; today: string; onClose: () => void }) {
  const a = target.appraisal;
  const form = a ? a.form : (target as { form: AppraisalForm }).form;
  const cycle = a ? a.cycle : (target as { cycle: string }).cycle;
  const editable = !a || a.status === "interviewed" || a.status === "proposed";
  const [id, setId] = useState<string | null>(a?.id ?? null);
  const [answers, setAnswers] = useState<Answers>(a?.answers ?? {});
  const [interviewOn, setInterviewOn] = useState<string>(a?.interview_on ?? today);
  const [saved, setSaved] = useState(!!a);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const open = target.stint.positions.find((p) => p.to_date === null);
  const [prop, setProp] = useState({
    designation: a?.proposed_designation ?? open?.designation ?? "",
    basic: String(a?.proposed_basic ?? ""), allowances: String(a?.proposed_allowances ?? open?.allowances ?? 0),
    effective_from: a?.effective_from ?? "", note: a?.proposal_note ?? "",
  });
  const [decisionNote, setDecisionNote] = useState("");
  const set = (k: string, v: unknown) => { setAnswers((x) => ({ ...x, [k]: v })); setSaved(false); };
  const gaps = interviewGaps(answers, interviewOn || null);

  const save = () => start(async () => {
    const r = await saveAppraisalInterview({ id, employment_id: target.stint.id, cycle, kind: form.kind, interview_on: interviewOn || null, answers });
    setMsg(r);
    if (r.ok) { setSaved(true); if (r.id) setId(r.id); }
  });

  return (
    <div className="space-y-5">
      <Flash msg={msg} />
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="section-title">Form</dt><dd>{form.title}</dd></div>
        <div><dt className="section-title">Current role</dt><dd>{a?.current_designation ?? open?.designation ?? "-"}</dd></div>
        <div><dt className="section-title">Current salary</dt><dd>{money(a ? a.current_basic : open?.basic ?? null)} basic{(a ? a.current_allowances : open?.allowances) ? ` + ${money(a ? a.current_allowances : open?.allowances ?? null)}` : ""}</dd></div>
        <label><span className="section-title">Interview date</span>
          <input type="date" className="input mt-1 !py-1" max={today} value={interviewOn} disabled={!editable} onChange={(e) => { setInterviewOn(e.target.value); setSaved(false); }} /></label>
      </dl>

      {form.sections.map((sec) => <FormSection key={sec.key} sec={sec} cycle={cycle} answers={answers} set={set} disabled={!editable} />)}

      {editable && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          {!saved && <span className="text-xs text-amber-700">Unsaved changes</span>}
          <button className="btn-outline" onClick={onClose}>Close</button>
          <button className="btn-primary" disabled={pending} onClick={save}>Save interview</button>
        </div>
      )}

      {id && editable && (
        <section className="space-y-3 rounded-lg border p-3">
          <h3 className="font-semibold">Propose the new salary</h3>
          {gaps.length > 0 || !saved ? (
            <p className="text-sm text-slate-600">{!saved ? "Save the interview first." : `Still needed before a proposal: ${gaps.join(", ")}.`}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="sm:col-span-2"><span className="section-title">Designation (change it for a promotion)</span>
                  <input className="input mt-1" value={prop.designation} onChange={(e) => setProp({ ...prop, designation: e.target.value })} /></label>
                <label><span className="section-title">New basic (₹/month)</span>
                  <input className="input mt-1" inputMode="numeric" value={prop.basic} onChange={(e) => setProp({ ...prop, basic: e.target.value })} /></label>
                <label><span className="section-title">Allowances (₹/month)</span>
                  <input className="input mt-1" inputMode="numeric" value={prop.allowances} onChange={(e) => setProp({ ...prop, allowances: e.target.value })} /></label>
                <label><span className="section-title">Starts from</span>
                  <input type="date" className="input mt-1" value={prop.effective_from} onChange={(e) => setProp({ ...prop, effective_from: e.target.value })} /></label>
                <label className="sm:col-span-3"><span className="section-title">Note for admin</span>
                  <input className="input mt-1" value={prop.note} onChange={(e) => setProp({ ...prop, note: e.target.value })} /></label>
              </div>
              <div className="flex justify-end">
                <button className="btn-primary" disabled={pending} onClick={() => start(async () => setMsg(await proposeAppraisal({
                  id: id!, designation: prop.designation, basic: Number(prop.basic), allowances: Number(prop.allowances || 0), effective_from: prop.effective_from, note: prop.note,
                })))}>{a?.status === "proposed" ? "Update proposal" : "Send to admin"}</button>
              </div>
            </>
          )}
        </section>
      )}

      {a && a.status !== "interviewed" && (
        <section className="space-y-2 rounded-lg border p-3 text-sm">
          <h3 className="font-semibold">Proposal</h3>
          <p>{a.proposed_designation ?? a.current_designation ?? "-"} · {money(a.proposed_basic)} basic + {money(a.proposed_allowances)} allowances
            {risePct(a) != null && <> · <b>{risePct(a)}%</b> rise in gross</>} · from {formatDate(a.effective_from)}</p>
          {a.proposal_note && <p className="text-slate-600">“{a.proposal_note}”</p>}
          <p className="text-xs text-slate-500">Proposed by {a.proposed_by}{a.decided_by && <> · {a.status === "approved" ? "approved" : "not approved"} by {a.decided_by} on {formatDate(a.decided_at?.slice(0, 10))}</>}</p>
          {a.decision_note && <p className="text-slate-600">Admin: “{a.decision_note}”</p>}
          {admin && a.status === "proposed" && (
            <div className="flex flex-wrap items-end gap-2 border-t pt-2">
              <label className="min-w-0 flex-1"><span className="section-title">Note (optional)</span>
                <input className="input mt-1" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} /></label>
              <button className="btn-outline" disabled={pending} onClick={() => start(async () => { const r = await decideAppraisal(a.id, false, decisionNote); setMsg(r); if (r.ok) onClose(); })}>Not approve</button>
              <button className="btn-primary" disabled={pending || !saved} onClick={() => start(async () => { const r = await decideAppraisal(a.id, true, decisionNote); setMsg(r); if (r.ok) onClose(); })}>Approve</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function FormSection({ sec, cycle, answers, set, disabled }: { sec: AppraisalSection; cycle: string; answers: Answers; set: (k: string, v: unknown) => void; disabled: boolean }) {
  const years = sec.years === "past" ? pastYears(cycle) : null;
  if (years) {
    return (
      <section>
        <h3 className="section-title mb-1">{sec.title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-1.5 pr-2" />{years.map((y) => <th key={y} className="px-1">{y}</th>)}</tr></thead>
            <tbody>{sec.fields.map((f) => (
              <tr key={f.key} className="border-b last:border-0">
                <td className="py-1 pr-2">{f.label}</td>
                {years.map((y) => <td key={y} className="min-w-[9rem] px-1 py-1"><FieldInput f={f} k={answerKey(sec, f, y)} answers={answers} set={set} disabled={disabled} label={`${f.label}, ${y}`} /></td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    );
  }
  const title = sec.years === "next" ? `${sec.title} (${cycle})` : sec.title;
  return (
    <section>
      <h3 className="section-title mb-1">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {sec.fields.map((f) => (
          <label key={f.key} className={f.type === "check" ? "flex items-start gap-2 text-sm sm:col-span-2" : f.type === "text" ? "text-sm sm:col-span-2" : "text-sm"}>
            {f.type !== "check" && <span className="text-slate-700">{f.label}</span>}
            <FieldInput f={f} k={answerKey(sec, f)} answers={answers} set={set} disabled={disabled} label={f.label} />
            {f.type === "check" && <span>{f.label}</span>}
          </label>
        ))}
      </div>
    </section>
  );
}

function FieldInput({ f, k, answers, set, disabled, label }: { f: AppraisalField; k: string; answers: Answers; set: (k: string, v: unknown) => void; disabled: boolean; label: string }) {
  const v = answers[k];
  if (f.type === "check") return <input type="checkbox" className="mt-0.5 h-4 w-4" checked={v === true} disabled={disabled} onChange={(e) => set(k, e.target.checked)} />;
  if (f.type === "grade") {
    return (
      <select className="input mt-0.5 !py-1" aria-label={label} value={(v as string) ?? ""} disabled={disabled} onChange={(e) => set(k, e.target.value)}>
        <option value="">-</option>{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>
    );
  }
  if (f.type === "text") return <textarea className="input mt-0.5 !py-1" rows={2} aria-label={label} value={(v as string) ?? ""} disabled={disabled} onChange={(e) => set(k, e.target.value)} />;
  return <input className="input mt-0.5 !py-1" inputMode="decimal" aria-label={label} value={v == null ? "" : String(v)} disabled={disabled} onChange={(e) => set(k, e.target.value)} />;
}
