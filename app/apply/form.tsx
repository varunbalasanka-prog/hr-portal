"use client";
import { useState, useTransition } from "react";
import { fieldName, groupBySection, isVisible, MAX_ANSWER, type ApplyQuestion } from "@/lib/apply-questions";
import { submitApplication } from "./actions";
import type { ApplyConfig } from "./config";

/** Fixed fields (branch, post, name, mobile, father's name, marital status, email, address) feed the candidate record and
 *  letters, so they can't be removed. Everything else comes from the questions the admin manages. */
export function ApplyForm({ branches, posts, questions }: ApplyConfig) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const towns = [...new Set(branches.map((b) => b.town))];
  const visible = questions.filter((q) => isVisible(q, choices, questions));
  const sections = groupBySection(visible);
  const aboutYou = sections.find(([s]) => s === "About you")?.[1] ?? [];
  const others = sections.filter(([s]) => s !== "About you");

  if (done) {
    return (
      <div className="py-6 text-center">
        <h2 className="mb-2 text-lg font-bold text-green-700">Application submitted</h2>
        <p className="text-sm text-slate-600">Thank you. Our HR team will call you soon.</p>
        <p className="mt-1 text-sm text-slate-600">நன்றி. எங்கள் HR குழு விரைவில் உங்களைத் தொடர்பு கொள்ளும்.</p>
      </div>
    );
  }

  const question = (q: ApplyQuestion) => (
    <Question key={q.id} q={q} value={choices[q.id] ?? ""} onChoose={(v) => setChoices((s) => ({ ...s, [q.id]: v }))} />
  );

  return (
    <form
      className="space-y-5"
      action={(fd) => start(async () => {
        const r = await submitApplication(fd);
        if (r.ok) setDone(true); else { setError(r.message); window.scrollTo({ top: 0, behavior: "smooth" }); }
      })}
    >
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Section n={1} title="Job you are applying for">
        <label className="block sm:col-span-2">
          <span className="label">Branch / கிளை *</span>
          <select name="branch_id" className="input" required defaultValue="">
            <option value="">-- Select --</option>
            {towns.map((t) => (
              <optgroup key={t} label={t}>
                {branches.filter((b) => b.town === t).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.business_type})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Post applying for / பதவி *</span>
          <input name="post" className="input" list="posts" required maxLength={120} placeholder="Choose or type" />
          <datalist id="posts">{posts.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
      </Section>

      <Section n={2} title="About you">
        <Input name="name" label="Full name / பெயர் *" required maxLength={120} />
        <Input name="mobile" label="Mobile number *" inputMode="tel" pattern="[0-9+ ]{10,14}" required />
        <Input name="father_name" label="Father's / husband's name *" required maxLength={120} />
        <label className="block">
          <span className="label">Marital status *</span>
          <select name="marital_status" className="input" required defaultValue="">
            <option value="">-- Select --</option>
            <option>Single</option><option>Married</option>
          </select>
        </label>
        <Input name="email" label="Email" type="email" maxLength={120} />
        {aboutYou.map(question)}
        <label className="block sm:col-span-2">
          <span className="label">Address *</span>
          <textarea name="address" className="input" rows={2} required maxLength={500} />
        </label>
      </Section>

      {others.map(([title, qs], i) => <Section key={title} n={i + 3} title={title}>{qs.map(question)}</Section>)}

      <p className="text-xs text-slate-500">Photos or PDFs only, up to 8 MB each. Your details are stored privately and only our HR team can see them.</p>
      <button className="btn-primary h-11 w-full" disabled={pending}>{pending ? "Submitting… please wait" : "Submit application"}</button>
    </form>
  );
}

function Question({ q, value, onChoose }: { q: ApplyQuestion; value: string; onChoose: (v: string) => void }) {
  const label = q.label + (q.required ? " *" : "");
  const name = fieldName(q);
  switch (q.type) {
    case "choice":
      return (
        <label className="block">
          <span className="label">{label}</span>
          <select name={name} className="input" required={q.required} value={value} onChange={(e) => onChoose(e.target.value)}>
            <option value="">-- Select --</option>
            {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      );
    case "long_text":
      return (
        <label className="block sm:col-span-2">
          <span className="label">{label}</span>
          <textarea name={name} className="input" rows={3} required={q.required} maxLength={MAX_ANSWER.long_text} />
        </label>
      );
    case "file":
      return (
        <label className="block">
          <span className="label">{label}</span>
          <input type="file" name={name} className="input" accept="image/*,application/pdf" required={q.required} />
        </label>
      );
    case "date":
      return <Input name={name} label={label} type="date" required={q.required} />;
    case "number":
      return <Input name={name} label={label} inputMode="numeric" required={q.required} maxLength={MAX_ANSWER.number} />;
    default:
      return <Input name={name} label={label} required={q.required} maxLength={MAX_ANSWER.text} />;
  }
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-sm font-bold text-brand">{n}. {title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block"><span className="label">{label}</span><input className="input" {...props} /></label>;
}
