"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelExit, confirmExit, raiseExit, relieveExit, saveExitForm, saveExitInterview, skipExitInterview } from "@/app/actions/exits";
import {
  KIND_OPTIONS, QUESTION_TYPES, REHIRE_OPTIONS, STEP_LABEL, STORE_KINDS, YES_NO, answerText, letterAllowed, nextStep, openExit,
  type ExitAnswers, type ExitForm, type ExitQuestion, type ExitStep, type QuestionType, type StaffExit,
} from "@/lib/exit";
import { EXIT_LABEL, type StaffStint } from "@/lib/staff";
import { formatDate } from "@/lib/dates";
import { Badge, Field, Flash, Modal } from "@/components/ui";

type Msg = { ok: boolean; message: string } | null;
const STEP_TONE: Record<ExitStep, "amber" | "sky" | "slate" | "green" | "zinc"> = {
  confirm: "amber", interview: "amber", wait: "sky", relieve: "green", done: "zinc", cancelled: "zinc",
};

/** "Leaving 30 Nov" badge for the Current list. */
export function LeavingBadge({ x, today }: { x: StaffExit | null; today: string }) {
  if (!x) return null;
  const step = nextStep(x, today);
  return <Badge tone={step === "relieve" ? "green" : "amber"} dot>{x.kind === "absconded" ? "Absconding" : "Leaving"} {formatDate(x.last_day)}</Badge>;
}

/** HR / admin to-do: open exits with what has to happen next. */
export function PendingExits({ list, stints, bName, today, onOpen }: {
  list: StaffExit[]; stints: StaffStint[]; bName: (s: StaffStint) => string; today: string; onOpen: (s: StaffStint) => void;
}) {
  const byId = new Map(stints.map((s) => [s.id, s]));
  const open = list.filter((x) => (x.status === "raised" || x.status === "confirmed") && byId.has(x.employment_id))
    .sort((a, b) => a.last_day.localeCompare(b.last_day));
  if (open.length === 0) return null;
  return (
    <div className="card border-amber-200 bg-amber-50/50 p-3">
      <div className="section-title mb-2">Staff leaving ({open.length})</div>
      <ul className="divide-y text-sm">
        {open.map((x) => {
          const s = byId.get(x.employment_id)!;
          const step = nextStep(x, today);
          return (
            <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
              <button className="font-semibold hover:underline" onClick={() => onOpen(s)}>{s.name}</button>
              <span className="text-slate-600">{bName(s)}</span>
              <span className="text-xs text-slate-500">{EXIT_LABEL[x.kind]} · last day {formatDate(x.last_day)}</span>
              <Badge tone={STEP_TONE[step]}>{STEP_LABEL[step]}</Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Draft = { kind: string; informed_on: string; last_day: string; reason: string };

function DetailsForm({ draft, set, store }: { draft: Draft; set: (d: Draft) => void; store: boolean }) {
  const kinds = store ? KIND_OPTIONS.filter((k) => STORE_KINDS.includes(k.value)) : KIND_OPTIONS;
  const absconding = draft.kind === "absconded";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="How are they leaving? *">
        <select className="input" value={draft.kind} onChange={(e) => set({ ...draft, kind: e.target.value })}>
          {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </Field>
      <Field label={absconding ? "Last day they came to work *" : "Last working day *"}>
        <input type="date" className="input" value={draft.last_day} onChange={(e) => set({ ...draft, last_day: e.target.value })} />
      </Field>
      <Field label={absconding ? "Day you noticed" : "Day they resigned"}>
        <input type="date" className="input" value={draft.informed_on} onChange={(e) => set({ ...draft, informed_on: e.target.value })} />
      </Field>
      <Field label={absconding ? "Anything you know" : "Reason they gave"}>
        <input className="input" maxLength={500} value={draft.reason} onChange={(e) => set({ ...draft, reason: e.target.value })} />
      </Field>
    </div>
  );
}

/** The exit section inside a person's timeline. */
export function ExitBlock({ s, list, store, today, onInterview }: {
  s: StaffStint; list: StaffExit[]; store: boolean; today: string; onInterview: (x: StaffExit) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const x = openExit(list, s.id);
  const last = list.filter((e) => e.employment_id === s.id && e.status === "relieved").sort((a, b) => b.raised_at.localeCompare(a.raised_at))[0] ?? null;
  const fromExit = (e: StaffExit): Draft => ({ kind: e.kind, informed_on: e.informed_on ?? "", last_day: e.last_day, reason: e.reason_given ?? "" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cancelNote, setCancelNote] = useState<string | null>(null);
  const hr = !store;
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) => start(async () => {
    const r = await fn();
    setMsg(r);
    if (r.ok) { setDraft(null); setCancelNote(null); after?.(); router.refresh(); }
  });

  // Already left.
  if (s.left_on) {
    return (
      <section className="space-y-2">
        <h3 className="section-title">Exit</h3>
        {last ? <>
          <p className="text-sm">Relieved by {last.relieved_by} on {formatDate(last.relieved_at)}. {last.interview_status === "skipped"
            ? <>Exit interview skipped{hr && last.skip_reason ? `: ${last.skip_reason}` : ""}.</>
            : last.interview_status === "done" ? <>Exit interview taken on {formatDate(last.interview_on)}.</> : null}</p>
          {hr && last.interview_status === "done" && <Answers x={last} />}
        </> : <p className="text-sm text-slate-500">Left before the exit process was in the portal.</p>}
        {hr && letterAllowed(s, null) && (
          <a className="btn-outline inline-flex" href={`/staff/relieving/${s.id}`} target="_blank" rel="noreferrer">Relieving &amp; experience letter</a>
        )}
      </section>
    );
  }

  // Working, nothing raised yet.
  if (!x) {
    return (
      <section className="space-y-2">
        <h3 className="section-title">Exit</h3>
        <Flash msg={msg} />
        {!draft ? (
          <button className="btn-outline" onClick={() => { setMsg(null); setDraft({ kind: "resigned", informed_on: today, last_day: "", reason: "" }); }}>
            {store ? "Raise resignation" : "Start exit (resignation, absconding…)"}
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-600">{store ? "HR will confirm the last day and take the exit interview." : "Next you take the exit interview, then relieve them on or after the last day."}</p>
            <DetailsForm draft={draft} set={setDraft} store={store} />
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setDraft(null)}>Close</button>
              <button className="btn-primary" disabled={pending} onClick={() => run(() => raiseExit(s.id, { ...draft, informed_on: draft.informed_on || null }))}>
                {store ? "Send to HR" : "Start exit"}
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  const step = nextStep(x, today);
  const steps: { label: string; done: boolean; note?: string }[] = [
    { label: x.status === "raised" ? `Raised by ${x.raised_by}` : `Raised by ${x.raised_by}, confirmed by ${x.confirmed_by}`, done: x.status !== "raised", note: formatDate(x.raised_at) },
    { label: x.interview_status === "skipped" ? "Exit interview skipped" : "Exit interview", done: x.interview_status !== "pending",
      note: x.interview_status === "done" ? formatDate(x.interview_on) : x.interview_status === "pending" ? `before ${formatDate(x.last_day)}` : undefined },
    { label: "Relieve", done: false, note: `from ${formatDate(x.last_day)}` },
  ];
  const canCancel = hr || (x.status === "raised");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title">Exit</h3>
        <Badge tone={STEP_TONE[step]}>{STEP_LABEL[step]}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <div><dt className="section-title">How</dt><dd>{EXIT_LABEL[x.kind]}</dd></div>
        <div><dt className="section-title">Last working day</dt><dd>{formatDate(x.last_day)}</dd></div>
        {x.informed_on && <div><dt className="section-title">{x.kind === "absconded" ? "Noticed" : "Resigned on"}</dt><dd>{formatDate(x.informed_on)}</dd></div>}
      </dl>
      {x.reason_given && <p className="text-sm"><span className="font-semibold">Reason given:</span> {x.reason_given}</p>}
      <ol className="space-y-1.5 text-sm">
        {steps.map((st, i) => (
          <li key={i} className="flex items-baseline gap-2">
            <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${st.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>{st.done ? "✓" : i + 1}</span>
            <span>{st.label}</span>{st.note && <span className="text-xs text-slate-500">{st.note}</span>}
          </li>
        ))}
      </ol>
      {store && <p className="text-xs text-slate-500">HR takes it from here. You&apos;ll see them under Past once HR relieves them.</p>}
      <Flash msg={msg} />

      {draft ? (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          <DetailsForm draft={draft} set={setDraft} store={false} />
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setDraft(null)}>Close</button>
            <button className="btn-primary" disabled={pending} onClick={() => run(() => confirmExit(x.id, { ...draft, informed_on: draft.informed_on || null }))}>
              {x.status === "raised" ? "Confirm" : "Save"}
            </button>
          </div>
        </div>
      ) : cancelNote !== null ? (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <Field label="Why (for example: took back the resignation)"><input className="input" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setCancelNote(null)}>Close</button>
            <button className="btn-primary" disabled={pending} onClick={() => run(() => cancelExit(x.id, cancelNote))}>Cancel the exit, they stay</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {hr && x.status === "raised" && <button className="btn-primary" onClick={() => { setMsg(null); setDraft(fromExit(x)); }}>Confirm last day</button>}
          {hr && x.status === "confirmed" && <button className="btn-outline" onClick={() => { setMsg(null); setDraft(fromExit(x)); }}>Change dates</button>}
          {hr && <button className={step === "interview" ? "btn-primary" : "btn-outline"} onClick={() => onInterview(x)}>
            {x.interview_status === "pending" ? "Exit interview" : "View or edit interview"}</button>}
          {hr && x.status === "confirmed" && x.interview_status !== "pending" && (
            <button className="btn-primary" disabled={pending || x.last_day > today} title={x.last_day > today ? `From ${formatDate(x.last_day)}` : undefined}
              onClick={() => { if (confirm(`Relieve ${s.name} with last working day ${formatDate(x.last_day)}?`)) run(() => relieveExit(x.id)); }}>
              {x.last_day > today ? `Relieve (from ${formatDate(x.last_day)})` : "Relieve"}
            </button>
          )}
          {canCancel && <button className="btn-outline" onClick={() => { setMsg(null); setCancelNote(""); }}>They are staying</button>}
        </div>
      )}
    </section>
  );
}

function Answers({ x }: { x: StaffExit }) {
  const form = x.form;
  if (!form) return null;
  return (
    <details className="rounded-lg border border-slate-200 p-2 text-sm">
      <summary className="cursor-pointer font-semibold">Exit interview answers</summary>
      <dl className="mt-2 space-y-1.5">
        <div className="text-xs text-slate-500">{x.interview_mode === "in person" ? "In person" : "By phone"} · {formatDate(x.interview_on)} · {x.interviewed_by}</div>
        {form.questions.map((q) => (
          <div key={q.key}><dt className="text-xs text-slate-500">{q.label}</dt><dd>{answerText(q, x.answers?.[q.key])}</dd></div>
        ))}
        {x.rehire && <div><dt className="text-xs text-slate-500">Rehire</dt><dd>{x.rehire}</dd></div>}
        {x.hr_notes && <div><dt className="text-xs text-slate-500">HR notes</dt><dd className="whitespace-pre-wrap">{x.hr_notes}</dd></div>}
      </dl>
    </details>
  );
}

/** The exit interview sheet: questions in English and Tamil, rehire, notes; or skip with a reason. */
export function InterviewSheet({ target, form, today, onClose }: { target: { x: StaffExit; name: string } | null; form: ExitForm; today: string; onClose: () => void }) {
  if (!target) return null;
  return <Sheet key={target.x.id + target.x.interview_status} target={target} form={target.x.form ?? form} today={today} onClose={onClose} />;
}

function Sheet({ target: { x, name }, form, today, onClose }: { target: { x: StaffExit; name: string }; form: ExitForm; today: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [mode, setMode] = useState<string>(x.interview_mode ?? "phone");
  const [on, setOn] = useState(x.interview_on ?? today);
  const [answers, setAnswers] = useState<ExitAnswers>(x.answers ?? {});
  const [notes, setNotes] = useState(x.hr_notes ?? "");
  const [rehire, setRehire] = useState<string>(x.rehire ?? "");
  const [skip, setSkip] = useState<string | null>(null);
  const set = (k: string, v: ExitAnswers[string] | undefined) => setAnswers((a) => { const n = { ...a }; if (v === undefined || v === "") delete n[k]; else n[k] = v; return n; });
  const finish = (r: { ok: boolean; message: string }) => { setMsg(r); if (r.ok) { router.refresh(); onClose(); } };

  return (
    <Modal open onClose={onClose} side title={`Exit interview · ${name}`} subtitle={`${EXIT_LABEL[x.kind]} · last working day ${formatDate(x.last_day)}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="How"><select className="input" value={mode} onChange={(e) => setMode(e.target.value)}><option value="phone">By phone</option><option value="in person">In person</option></select></Field>
          <Field label="Date"><input type="date" className="input" max={today} value={on} onChange={(e) => setOn(e.target.value)} /></Field>
        </div>
        {form.questions.map((q) => <QuestionInput key={q.key} q={q} value={answers[q.key]} onChange={(v) => set(q.key, v)} />)}
        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <div className="section-title">HR only</div>
          <Field label="Would we take them back?">
            <select className="input" value={rehire} onChange={(e) => setRehire(e.target.value)}>
              <option value="">-- Select --</option>{REHIRE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Notes"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <Flash msg={msg} />
        {skip === null ? (
          <div className="flex flex-wrap justify-end gap-2">
            {x.interview_status !== "done" && <button className="btn-outline" onClick={() => setSkip(x.skip_reason ?? "")}>Skip interview</button>}
            <button className="btn-primary" disabled={pending}
              onClick={() => start(async () => finish(await saveExitInterview(x.id, { mode, on, answers, notes, rehire: rehire || null })))}>Save interview</button>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <Field label="Why skip? (for example: not reachable after 3 calls)"><input className="input" value={skip} onChange={(e) => setSkip(e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setSkip(null)}>Back</button>
              <button className="btn-primary" disabled={pending} onClick={() => start(async () => finish(await skipExitInterview(x.id, skip, rehire || null)))}>Skip and continue</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function QuestionInput({ q, value, onChange }: { q: ExitQuestion; value: ExitAnswers[string] | undefined; onChange: (v: ExitAnswers[string] | undefined) => void }) {
  const title = (
    <legend className="text-sm font-semibold text-slate-800">
      {q.label}{q.required && " *"}{q.label_ta && <span className="block font-sans text-xs font-normal text-slate-500">{q.label_ta}</span>}
    </legend>
  );
  const chip = (on: boolean) => `chip ${on ? "chip-on" : ""}`;
  return (
    <fieldset className="space-y-1.5">
      {title}
      {q.type === "text" && <textarea className="input" rows={2} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={q.label} />}
      {q.type === "choice" && (
        <div className="flex flex-wrap gap-1.5">{q.options?.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} className={chip(value === o)} onClick={() => onChange(value === o ? undefined : o)}>{o}</button>
        ))}</div>
      )}
      {q.type === "multi" && (
        <div className="flex flex-wrap gap-1.5">{q.options?.map((o) => {
          const list = Array.isArray(value) ? value : [];
          const on = list.includes(o);
          return <button key={o} type="button" aria-pressed={on} className={chip(on)} onClick={() => { const n = on ? list.filter((v) => v !== o) : [...list, o]; onChange(n.length ? n : undefined); }}>{o}</button>;
        })}</div>
      )}
      {q.type === "yesno" && (
        <div className="flex flex-wrap gap-1.5">{YES_NO.map((y) => (
          <button key={y.value} type="button" aria-pressed={value === y.value} className={chip(value === y.value)} onClick={() => onChange(value === y.value ? undefined : y.value)}>
            {y.label} <span className="text-xs opacity-70">{y.ta}</span>
          </button>
        ))}</div>
      )}
      {q.type === "rating" && (
        <div className="space-y-1">{q.options?.map((item) => {
          const r = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, number>;
          return (
            <div key={item} className="flex flex-wrap items-center gap-1.5">
              <span className="w-28 text-sm">{item}</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${item} ${n}`} aria-pressed={r[item] === n} className={`${chip(r[item] === n)} !px-2.5`}
                  onClick={() => { const next = { ...r }; if (next[item] === n) delete next[item]; else next[item] = n; onChange(Object.keys(next).length ? next : undefined); }}>{n}</button>
              ))}
            </div>
          );
        })}</div>
      )}
    </fieldset>
  );
}

/** Admin: add, edit, reorder or remove the exit interview questions. Past interviews keep the wording they were taken on. */
export function ExitFormEditor({ open, onClose, form }: { open: boolean; onClose: () => void; form: ExitForm }) {
  const router = useRouter();
  const [qs, setQs] = useState<ExitQuestion[]>(() => structuredClone(form.questions));
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const change = (fn: (a: ExitQuestion[]) => void) => setQs((prev) => { const n = structuredClone(prev); fn(n); return n; });
  const hasOptions = (t: QuestionType) => t === "choice" || t === "multi" || t === "rating";
  return (
    <Modal open={open} onClose={onClose} wide title="Exit interview questions"
      subtitle="Changes apply to interviews taken from now on. Interviews already taken keep the questions they were asked.">
      <div className="max-h-[65vh] space-y-3 overflow-y-auto">
        {qs.map((q, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Question (English)"><input className="input" value={q.label} onChange={(e) => change((a) => { a[i].label = e.target.value; })} /></Field>
              <Field label="Question (Tamil)"><input className="input" value={q.label_ta ?? ""} onChange={(e) => change((a) => { a[i].label_ta = e.target.value; })} /></Field>
              <Field label="Answer type">
                <select className="input" value={q.type} onChange={(e) => change((a) => { a[i].type = e.target.value as QuestionType; })}>
                  {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              {q.type !== "rating" && (
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input type="checkbox" checked={!!q.required} onChange={(e) => change((a) => { a[i].required = e.target.checked; })} /> Must be answered
                </label>
              )}
            </div>
            {hasOptions(q.type) && (
              <Field label={q.type === "rating" ? "Items to rate, one per line" : "Choices, one per line"}>
                <textarea className="input" rows={4} value={(q.options ?? []).join("\n")} onChange={(e) => change((a) => { a[i].options = e.target.value.split("\n"); })} />
              </Field>
            )}
            <div className="flex justify-end gap-1.5">
              <button className="btn-outline !px-2 !py-1 text-xs" aria-label="Move up" disabled={i === 0} onClick={() => change((a) => { [a[i - 1], a[i]] = [a[i], a[i - 1]]; })}>↑</button>
              <button className="btn-outline !px-2 !py-1 text-xs" aria-label="Move down" disabled={i === qs.length - 1} onClick={() => change((a) => { [a[i + 1], a[i]] = [a[i], a[i + 1]]; })}>↓</button>
              <button className="btn-outline !px-2 !py-1 text-xs" onClick={() => change((a) => { a.splice(i, 1); })}>Remove</button>
            </div>
          </div>
        ))}
        <button className="text-sm font-semibold text-brand hover:underline" onClick={() => change((a) => { a.push({ key: "", label: "", type: "text" }); })}>+ Add question</button>
      </div>
      <Flash msg={msg} />
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Close</button>
        <button className="btn-primary" disabled={pending} onClick={() => start(async () => {
          const r = await saveExitForm({ version: form.version, questions: qs.map((q) => ({ ...q, options: q.options?.map((o) => o.trim()).filter(Boolean) })) });
          setMsg(r);
          if (r.ok) router.refresh();
        })}>Save questions</button>
      </div>
    </Modal>
  );
}
