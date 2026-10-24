"use client";
import { useState, useTransition } from "react";
import { fieldName, groupBySection, isVisible, latestDate, MAX_ANSWER, splitBilingual, todayInIndia, type ApplyQuestion } from "@/lib/apply-questions";
import { submitApplication } from "./actions";
import type { ApplyConfig } from "./config";

const SELECT = "-- Select / தேர்வு செய்க --";
const ABOUT_YOU = "About you / உங்களைப் பற்றி";
const isAboutYou = (section: string) => splitBilingual(section)[0].toLowerCase() === "about you";
// long questions get the full row so their answer box isn't squeezed
const wide = (q: ApplyQuestion) =>
  q.type === "long_text" || splitBilingual(q.label)[0].length > 42 || q.options.some((o) => o.length > 24);

/** Fixed fields (branch, post, name, mobile, father's name, marital status, email, address) feed the candidate record and
 *  letters, so they can't be removed. Everything else comes from the questions the admin manages. */
export function ApplyForm({ branches, questions }: ApplyConfig) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [branchId, setBranchId] = useState("");
  const [post, setPost] = useState("");
  const posts = branches.find((b) => b.id === branchId)?.posts ?? [];
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const towns = [...new Set(branches.map((b) => b.town))];
  const visible = questions.filter((q) => isVisible(q, choices, questions));
  const sections = groupBySection(visible);
  const aboutYou = sections.find(([s]) => isAboutYou(s))?.[1] ?? [];
  const others = sections.filter(([s]) => !isAboutYou(s));

  if (!branches.length) {
    return (
      <div className="py-10 text-center text-sm text-slate-600">
        <p>There are no openings right now. Please check again later.</p>
        <p>தற்போது காலியிடங்கள் இல்லை. பின்னர் மீண்டும் பார்க்கவும்.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">✓</div>
        <h2 className="text-lg font-bold text-green-700">Application submitted</h2>
        <p className="text-sm font-semibold text-green-700">விண்ணப்பம் சமர்ப்பிக்கப்பட்டது</p>
        <p className="mt-3 text-sm text-slate-600">Thank you. Our HR team will call you soon.</p>
        <p className="text-sm text-slate-600">நன்றி. எங்கள் HR குழு விரைவில் உங்களைத் தொடர்பு கொள்ளும்.</p>
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
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <p className="text-xs text-slate-500">Fields marked <span className="text-red-600">*</span> are required. / <span className="text-red-600">*</span> குறியிட்டவை கட்டாயம்.</p>

      <Section n={1} title="Job you are applying for / நீங்கள் விண்ணப்பிக்கும் வேலை">
        <Field label="Branch / கிளை" required wide>
          <select name="branch_id" className="input h-10" required value={branchId}
            onChange={(e) => { setBranchId(e.target.value); setPost(""); }}>
            <option value="">{SELECT}</option>
            {towns.map((t) => (
              <optgroup key={t} label={t}>
                {branches.filter((b) => b.town === t).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.business_type})</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Post applying for / விண்ணப்பிக்கும் பதவி" required wide>
          <select name="post" className="input h-10 disabled:bg-slate-50 disabled:text-slate-400" required disabled={!branchId} value={post} onChange={(e) => setPost(e.target.value)}>
            <option value="">{branchId ? SELECT : "Choose a branch first / முதலில் கிளையைத் தேர்வு செய்க"}</option>
            {posts.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </Section>

      <Section n={2} title={ABOUT_YOU}>
        <Field label="Full name / முழுப் பெயர்" required><input name="name" className="input h-10" required maxLength={120} autoComplete="name" /></Field>
        <Field label="Mobile number / கைபேசி எண்" required>
          <input name="mobile" className="input h-10" type="tel" inputMode="numeric" pattern="[0-9+ ]{10,14}" required autoComplete="tel" placeholder="10 digits / 10 இலக்கங்கள்" />
        </Field>
        <Field label="Father's / husband's name / தந்தை / கணவர் பெயர்" required><input name="father_name" className="input h-10" required maxLength={120} /></Field>
        {aboutYou.map(question)}
        <Field label="Marital status / திருமண நிலை" required>
          <select name="marital_status" className="input h-10" required defaultValue="">
            <option value="">{SELECT}</option>
            <option value="Single">Single / திருமணம் ஆகாதவர்</option>
            <option value="Married">Married / திருமணம் ஆனவர்</option>
          </select>
        </Field>
        <Field label="Email / மின்னஞ்சல்"><input name="email" className="input h-10" type="email" maxLength={120} autoComplete="email" /></Field>
        <Field label="Address / முகவரி" required wide><textarea name="address" className="input" rows={3} required maxLength={500} autoComplete="street-address" /></Field>
      </Section>

      {others.map(([title, qs], i) => <Section key={title} n={i + 3} title={title}>{qs.map(question)}</Section>)}

      <p className="text-xs text-slate-500">
        Photos or PDFs only, up to 8 MB each. Your details are stored privately and only our HR team can see them.
        <br />புகைப்படம் அல்லது PDF மட்டும், ஒவ்வொன்றும் 8 MB வரை. உங்கள் விவரங்களை எங்கள் HR குழு மட்டுமே பார்க்க முடியும்.
      </p>
      <button className="btn-primary h-12 w-full text-base" disabled={pending}>
        {pending ? "Submitting… please wait / காத்திருக்கவும்" : "Submit application / விண்ணப்பத்தைச் சமர்ப்பிக்கவும்"}
      </button>
    </form>
  );
}

function Question({ q, value, onChoose }: { q: ApplyQuestion; value: string; onChoose: (v: string) => void }) {
  const name = fieldName(q);
  const field = (control: React.ReactNode) => <Field label={q.label} required={q.required} wide={wide(q)}>{control}</Field>;
  switch (q.type) {
    case "choice":
      return field(
        <select name={name} className="input h-10" required={q.required} value={value} onChange={(e) => onChoose(e.target.value)}>
          <option value="">{SELECT}</option>
          {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>,
      );
    case "long_text":
      return field(<textarea name={name} className="input" rows={3} required={q.required} maxLength={MAX_ANSWER.long_text} />);
    case "file":
      return field(
        <input type="file" name={name} accept="image/*,application/pdf" required={q.required}
          className="block h-10 w-full overflow-hidden rounded-md border border-slate-300 bg-white text-sm text-slate-600 file:mr-3 file:h-full file:cursor-pointer file:border-0 file:border-r file:border-slate-300 file:bg-slate-100 file:px-3 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-200" />,
      );
    case "date":
      return field(<input name={name} className="input h-10" type="date" required={q.required} max={q.min_age ? latestDate(q.min_age, todayInIndia()) : undefined} />);
    case "number":
      return field(<input name={name} className="input h-10" inputMode="numeric" required={q.required} maxLength={MAX_ANSWER.number} />);
    default:
      return field(<input name={name} className="input h-10" required={q.required} maxLength={MAX_ANSWER.text} />);
  }
}

/** English on the first line, Tamil under it, and the box pinned to the bottom so boxes in a row line up. */
function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  const [en, ta] = splitBilingual(label);
  return (
    <label className={`flex flex-col ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 flex-1">
        <span className="block text-sm font-semibold text-slate-800">{en}{required && <span className="ml-0.5 text-red-600">*</span>}</span>
        {ta && <span className="block text-xs text-slate-500">{ta}</span>}
      </span>
      {children}
    </label>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const [en, ta] = splitBilingual(title);
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{n}</span>
        <span>
          <span className="block text-sm font-bold text-brand">{en}</span>
          {ta && <span className="block text-xs font-semibold text-slate-500">{ta}</span>}
        </span>
      </header>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
