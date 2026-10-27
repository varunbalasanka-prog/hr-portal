"use client";
import { useEffect, useState, useTransition } from "react";
import { saveAppraisalForm } from "@/app/actions/appraisals";
import { DEFAULT_FORMS, FIELD_TYPES, LOCKED_FIELDS, type AppraisalForm, type FieldType, type FormKind } from "@/lib/appraisal";
import { Flash, Modal } from "@/components/ui";

const KINDS: { kind: FormKind; label: string }[] = [{ kind: "jewellery", label: "Jewellery stores" }, { kind: "automobile", label: "Automobile stores" }];
const YEARS_NOTE = { past: "Filled for each of the last two years", next: "Targets for the appraisal year" } as const;

/** Admin edits the appraisal forms: reword, add, remove and reorder questions. Past appraisals keep their own copy. */
export function FormEditor({ open, onClose, forms }: { open: boolean; onClose: () => void; forms: Record<FormKind, AppraisalForm> }) {
  const [kind, setKind] = useState<FormKind>("jewellery");
  const [drafts, setDrafts] = useState<Record<FormKind, AppraisalForm>>(() => structuredClone(forms));
  const [dirty, setDirty] = useState<Record<FormKind, boolean>>({ jewellery: false, automobile: false });
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const form = drafts[kind];
  // After a save the page sends the stored form back (new questions now have keys): show that, unless still editing.
  useEffect(() => {
    setDrafts((d) => ({ jewellery: dirty.jewellery ? d.jewellery : structuredClone(forms.jewellery), automobile: dirty.automobile ? d.automobile : structuredClone(forms.automobile) }));
  }, [forms]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (fn: (f: AppraisalForm) => void) => {
    const next = structuredClone(form);
    fn(next);
    setDrafts({ ...drafts, [kind]: next });
    setDirty({ ...dirty, [kind]: true });
    setMsg(null);
  };
  const locked = (sk: string, fk: string) => `${sk}.${fk}` in LOCKED_FIELDS;
  const close = () => { setDrafts(structuredClone(forms)); setDirty({ jewellery: false, automobile: false }); setMsg(null); onClose(); };

  return (
    <Modal open={open} onClose={close} wide title="Appraisal forms"
      subtitle="Changes apply to interviews started after you save. Appraisals already started keep the form they were filled on.">
      <Flash msg={msg} />
      <div className="mb-3 flex flex-wrap gap-2" role="tablist">
        {KINDS.map((k) => (
          <button key={k.kind} role="tab" aria-selected={kind === k.kind} className={`chip ${kind === k.kind ? "chip-on" : ""}`} onClick={() => { setKind(k.kind); setMsg(null); }}>
            {k.label}{dirty[k.kind] && " •"}
          </button>
        ))}
      </div>

      <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
        <label className="block text-sm"><span className="section-title">Form name</span>
          <input className="input mt-1" value={form.title} onChange={(e) => change((f) => { f.title = e.target.value; })} /></label>

        {form.sections.map((sec, si) => (
          <section key={`${sec.key}-${si}`} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm"><span className="section-title">Section</span>
                <input className="input mt-1 font-semibold" value={sec.title} onChange={(e) => change((f) => { f.sections[si].title = e.target.value; })} /></label>
              {sec.years && <span className="pb-2 text-xs text-slate-500">{YEARS_NOTE[sec.years]}</span>}
              {!sec.fields.some((x) => locked(sec.key, x.key)) && !sec.years && (
                <button className="btn-outline !py-1 text-xs" onClick={() => change((f) => { f.sections.splice(si, 1); })}>Remove section</button>
              )}
            </div>
            <ol className="mt-2 space-y-1.5">
              {sec.fields.map((fld, fi) => (
                <li key={`${fld.key}-${fi}`} className="flex flex-wrap items-center gap-1.5">
                  <input className={`input min-w-0 flex-1 !py-1 text-sm ${fld.type === "heading" ? "font-semibold" : ""}`} aria-label="Question" value={fld.label}
                    onChange={(e) => change((f) => { f.sections[si].fields[fi].label = e.target.value; })} />
                  <select className="input w-auto !py-1 text-sm" aria-label="Answer type" value={fld.type} disabled={locked(sec.key, fld.key)}
                    onChange={(e) => change((f) => { f.sections[si].fields[fi].type = e.target.value as FieldType; })}>
                    {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button className="btn-outline !px-2 !py-1 text-xs" aria-label="Move up" disabled={fi === 0}
                    onClick={() => change((f) => { const a = f.sections[si].fields; [a[fi - 1], a[fi]] = [a[fi], a[fi - 1]]; })}>↑</button>
                  <button className="btn-outline !px-2 !py-1 text-xs" aria-label="Move down" disabled={fi === sec.fields.length - 1}
                    onClick={() => change((f) => { const a = f.sections[si].fields; [a[fi + 1], a[fi]] = [a[fi], a[fi + 1]]; })}>↓</button>
                  <button className="btn-outline !px-2 !py-1 text-xs" aria-label="Remove" disabled={locked(sec.key, fld.key)}
                    title={locked(sec.key, fld.key) ? "Needed before a salary can be proposed" : undefined}
                    onClick={() => change((f) => { f.sections[si].fields.splice(fi, 1); })}>✕</button>
                </li>
              ))}
            </ol>
            <button className="mt-2 text-sm font-semibold text-brand hover:underline"
              onClick={() => change((f) => { f.sections[si].fields.push({ key: "", label: "", type: "number" }); })}>+ Add question</button>
          </section>
        ))}
        <button className="text-sm font-semibold text-brand hover:underline"
          onClick={() => change((f) => { f.sections.splice(f.sections.length - 1, 0, { key: "", title: "New section", fields: [] }); })}>+ Add section</button>
      </div>

      <div className="mt-3 flex flex-wrap justify-between gap-2 border-t pt-3">
        <button className="btn-outline" onClick={() => change((f) => { Object.assign(f, structuredClone(DEFAULT_FORMS[kind])); })}>Restore the original form</button>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={close}>Close</button>
          <button className="btn-primary" disabled={pending || !dirty[kind]} onClick={() => start(async () => {
            const r = await saveAppraisalForm(kind, form);
            setMsg(r);
            if (r.ok) setDirty({ ...dirty, [kind]: false });
          })}>Save {KINDS.find((k) => k.kind === kind)!.label.toLowerCase()} form</button>
        </div>
      </div>
    </Modal>
  );
}
