"use client";
import { useState, useTransition } from "react";
import { QUESTION_TYPES, type AdminQuestion, type QuestionInput } from "@/lib/apply-questions";
import { moveQuestion, savePosts, saveQuestion, setQuestionActive } from "@/app/actions/questions";
import { Badge, Field, Flash, Modal, Select } from "@/components/ui";

type Msg = { ok: boolean; message: string } | null;
const EMPTY: QuestionInput = { section: "More details", label: "", type: "text", options: [], required: false, show_when: null };

export function QuestionsAdmin({ questions, posts }: { questions: AdminQuestion[]; posts: string[] }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<{ id: string | null; input: QuestionInput } | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [postText, setPostText] = useState(posts.join("\n"));
  const live = questions.filter((q) => q.active);
  const deleted = questions.filter((q) => !q.active);
  const labelOf = (id: string) => questions.find((q) => q.id === id)?.label ?? "a deleted question";
  const run = (fn: () => Promise<Msg>) => start(async () => { const r = await fn(); if (r?.message) setMsg(r); });

  return (
    <section className="card p-3 lg:col-span-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Application form (hr.balasanka.in/apply)</h2>
        <div className="flex gap-2">
          <a href="/apply" target="_blank" className="btn-outline">Preview form ↗</a>
          <button className="btn-primary" onClick={() => setEditing({ id: null, input: EMPTY })}>+ Add question</button>
        </div>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        Branch, post, name, mobile, father&apos;s name, marital status, email and address are always asked. Changes here only affect new
        applications: every past application keeps the questions and answers exactly as they were when it was sent.
      </p>
      <Flash msg={msg} />

      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-xs text-slate-500"><th className="w-16">Order</th><th>Question</th><th>Section</th><th>Type</th><th /></tr></thead>
        <tbody>{live.map((q, i) => (
          <tr key={q.id} className="border-b align-top last:border-0">
            <td className="py-1.5 whitespace-nowrap">
              <button className="px-1 text-slate-500 disabled:opacity-30" disabled={pending || i === 0} onClick={() => run(() => moveQuestion(q.id, -1))} aria-label="Move up">▲</button>
              <button className="px-1 text-slate-500 disabled:opacity-30" disabled={pending || i === live.length - 1} onClick={() => run(() => moveQuestion(q.id, 1))} aria-label="Move down">▼</button>
            </td>
            <td className="py-1.5 pr-2">
              <b>{q.label}</b> {q.required && <Badge tone="red">required</Badge>}
              {q.type === "choice" && <div className="text-xs text-slate-500">Options: {q.options.join(", ")}</div>}
              {q.show_when && <div className="text-xs text-amber-700">Only asked when &quot;{labelOf(q.show_when.question_id)}&quot; is {q.show_when.equals}</div>}
            </td>
            <td className="pr-2 text-xs">{q.section}</td>
            <td className="pr-2 text-xs">{QUESTION_TYPES[q.type]}</td>
            <td className="whitespace-nowrap text-right">
              <button className="btn-outline !py-0.5" disabled={pending} onClick={() => setEditing({ id: q.id, input: { ...q } })}>Edit</button>{" "}
              <button className="btn-outline !py-0.5 text-red-700" disabled={pending}
                onClick={() => confirm(`Remove "${q.label}" from the form? Answers already given are kept.`) && run(() => setQuestionActive(q.id, false))}>Delete</button>
            </td>
          </tr>
        ))}</tbody>
      </table>

      {deleted.length > 0 && (
        <div className="mt-2 text-sm">
          <button className="text-xs text-slate-500 underline" onClick={() => setShowDeleted((s) => !s)}>{showDeleted ? "Hide" : "Show"} deleted questions ({deleted.length})</button>
          {showDeleted && <ul className="mt-1 space-y-1">{deleted.map((q) => (
            <li key={q.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
              <span className="text-slate-500 line-through">{q.label}</span>
              <button className="btn-outline !py-0.5" disabled={pending} onClick={() => run(() => setQuestionActive(q.id, true))}>Restore</button>
            </li>
          ))}</ul>}
        </div>
      )}

      <div className="mt-4 border-t pt-3">
        <h3 className="mb-1 text-sm font-bold">Posts applicants can pick</h3>
        <p className="mb-1 text-xs text-slate-500">One per line. Applicants can still type a post that isn&apos;t listed.</p>
        <textarea className="input font-mono text-xs" rows={8} value={postText} onChange={(e) => setPostText(e.target.value)} />
        <button className="btn-primary mt-2" disabled={pending} onClick={() => run(() => savePosts(postText))}>Save posts</button>
      </div>

      {editing && (
        <QuestionEditor
          key={editing.id ?? "new"} initial={editing.input} isNew={!editing.id} pending={pending}
          parents={live.filter((p) => p.type === "choice" && p.id !== editing.id)}
          sections={[...new Set(live.map((q) => q.section))]}
          onClose={() => setEditing(null)}
          onSave={(input) => start(async () => {
            const r = await saveQuestion(editing.id, input);
            setMsg(r);
            if (r.ok) setEditing(null);
          })}
          error={msg && !msg.ok ? msg.message : ""}
        />
      )}
    </section>
  );
}

function QuestionEditor({ initial, isNew, parents, sections, pending, error, onClose, onSave }: {
  initial: QuestionInput; isNew: boolean; parents: AdminQuestion[]; sections: string[]; pending: boolean; error: string;
  onClose: () => void; onSave: (q: QuestionInput) => void;
}) {
  const [q, setQ] = useState(initial);
  const [optionText, setOptionText] = useState(initial.options.join("\n"));
  const parent = parents.find((p) => p.id === q.show_when?.question_id);
  const set = (patch: Partial<QuestionInput>) => setQ((s) => ({ ...s, ...patch }));
  return (
    <Modal open onClose={onClose} title={isNew ? "Add question" : "Edit question"}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave({ ...q, options: optionText.split("\n") }); }}>
        {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {!isNew && <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">Past applications keep the old wording and answers. This change only applies to new applications.</p>}
        <Field label="Question (shown to applicants)"><input className="input" value={q.label} onChange={(e) => set({ label: e.target.value })} maxLength={300} required /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select value={q.type} onChange={(v) => set({ type: v as QuestionInput["type"] })} placeholder="-- Type --"
              options={Object.entries(QUESTION_TYPES).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Section">
            <input className="input" list="question-sections" value={q.section} onChange={(e) => set({ section: e.target.value })} maxLength={80} />
            <datalist id="question-sections">{["About you", ...sections].filter((s, i, a) => a.indexOf(s) === i).map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
        </div>
        {q.type === "choice" && (
          <Field label="Options (one per line)"><textarea className="input" rows={4} value={optionText} onChange={(e) => setOptionText(e.target.value)} /></Field>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={q.required} onChange={(e) => set({ required: e.target.checked })} /> Required</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Only ask when (optional)">
            <Select value={q.show_when?.question_id ?? ""} placeholder="Always ask"
              onChange={(v) => set({ show_when: v ? { question_id: v, equals: "" } : null })}
              options={parents.map((p) => ({ value: p.id, label: p.label.length > 50 ? p.label.slice(0, 50) + "…" : p.label }))} />
          </Field>
          {parent && (
            <Field label="…has the answer">
              <Select value={q.show_when?.equals ?? ""} onChange={(v) => set({ show_when: { question_id: parent.id, equals: v } })} options={parent.options} />
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
