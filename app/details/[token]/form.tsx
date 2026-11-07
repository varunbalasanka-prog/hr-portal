"use client";
import { useEffect, useRef, useState } from "react";
import { fieldName, groupBySection, isVisible, type ApplyQuestion } from "@/lib/apply-questions";
import { browserStorage, checkFile, extFor, shrinkImage } from "@/lib/upload-client";
import { bilingualMessage, Question, Section } from "@/components/question-fields";
import { startDetails, submitDetails } from "./actions";

type FieldError = { field?: string; message: string } | null;

/** Same look and checks as the apply page; files go straight from the phone to storage. */
export function DetailsForm({ token, name, questions }: { token: string; name: string; questions: ApplyQuestion[] }) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [error, setError] = useState<FieldError>(null);
  const [progress, setProgress] = useState("");
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    setReady(true);
    const form = formRef.current;
    if (!form) return;
    const onInvalid = (e: Event) => {
      const el = e.target as HTMLInputElement;
      el.setCustomValidity("");
      if (!el.validity.valid) el.setCustomValidity(bilingualMessage(el));
    };
    form.addEventListener("invalid", onInvalid, true);
    return () => form.removeEventListener("invalid", onInvalid, true);
  }, [done]);

  const visible = questions.filter((q) => isVisible(q, choices, questions));
  const sections = groupBySection(visible);
  const errFor = (n: string) => (error?.field === n ? error.message : undefined);

  if (done) {
    return (
      <div className="py-10 text-center" role="status">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700" aria-hidden>✓</div>
        <h2 className="text-lg font-bold text-green-700">Details submitted</h2>
        <p className="text-sm font-semibold text-green-700">விவரங்கள் சமர்ப்பிக்கப்பட்டன</p>
        <p className="mt-4 text-sm text-slate-700">Thank you. HR will contact you about the next step.</p>
        <p className="text-sm text-slate-700">நன்றி. அடுத்த படி குறித்து HR உங்களைத் தொடர்பு கொள்வார்.</p>
      </div>
    );
  }

  const fail = (e: FieldError) => {
    setError(e);
    setProgress("");
    const el = e?.field ? formRef.current?.elements.namedItem(e.field) : null;
    if (el instanceof HTMLElement) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (progress) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const picked = visible.filter((q) => q.type === "file").map((q) => [q, fd.get(fieldName(q))] as const)
      .filter((x): x is [ApplyQuestion, File] => x[1] instanceof File && x[1].size > 0);
    for (const q of questions.filter((x) => x.type === "file")) fd.delete(fieldName(q));

    if (picked.length) {
      setProgress("Checking… / சரிபார்க்கிறது…");
      const start = await startDetails(token);
      if (!start.ok) return fail({ message: start.message });
      const storage = browserStorage();
      for (const [i, [q, raw]] of picked.entries()) {
        setProgress(`Uploading file ${i + 1} of ${picked.length}… / கோப்பு பதிவேற்றம் ${i + 1}/${picked.length}…`);
        const f = await shrinkImage(raw);
        const bad = checkFile(f, q.label);
        if (bad) return fail({ field: fieldName(q), message: bad });
        const path = `${start.folder}/${q.id}.${extFor(f.type)}`;
        const { error: upErr } = await storage.from("applications").upload(path, f, { contentType: f.type });
        if (upErr) return fail({ field: fieldName(q), message: `Upload failed / பதிவேற்றம் தோல்வி: ${q.label}. Please check your internet and try again.` });
        fd.set(fieldName(q), path);
      }
      fd.set("folder", start.folder);
    }

    setProgress("Submitting… / சமர்ப்பிக்கிறது…");
    try {
      const r = await submitDetails(token, fd);
      if (r.ok) { setDone(true); window.scrollTo({ top: 0 }); return; }
      fail({ field: r.field, message: r.message });
    } catch {
      fail({ message: "Could not submit. Please check your internet and try again. / இணையத்தைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்." });
    }
  }

  return (
    <form ref={formRef} method="post" className="space-y-5" onSubmit={onSubmit}
      onInputCapture={(e) => (e.target as HTMLInputElement).setCustomValidity?.("")}
      onChangeCapture={(e) => (e.target as HTMLInputElement).setCustomValidity?.("")}>
      <p className="text-sm text-slate-700">
        Dear <b>{name}</b>, thank you for attending the interview. Please fill these details so HR can prepare your offer.
        <br /><span className="text-slate-600">நேர்காணலில் கலந்துகொண்டதற்கு நன்றி. உங்கள் பணி வாய்ப்பைத் தயாரிக்க இந்த விவரங்களை நிரப்பவும்.</span>
      </p>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error.message}</div>}
      <p className="text-xs text-slate-600">Fields marked <span className="text-red-700">*</span> are required. / <span className="text-red-700">*</span> குறியிட்டவை கட்டாயம்.</p>
      {sections.map(([title, qs], i) => (
        <Section key={title} n={i + 1} title={title}>
          {qs.map((q) => <Question key={q.id} q={q} value={choices[q.id] ?? ""} error={errFor(fieldName(q))} onChoose={(v) => setChoices((s) => ({ ...s, [q.id]: v }))} />)}
        </Section>
      ))}
      {visible.some((q) => q.type === "file") && (
        <p className="text-xs text-slate-600">
          Photos or PDFs only, up to 5 MB each. Large photos are made smaller on your phone before upload.
          <br />புகைப்படம் அல்லது PDF மட்டும், ஒவ்வொன்றும் 5 MB வரை.
        </p>
      )}
      <button className="btn-primary h-12 w-full text-base" disabled={!!progress || !ready} aria-live="polite">
        {progress || "Submit details / விவரங்களைச் சமர்ப்பிக்கவும்"}
      </button>
    </form>
  );
}
