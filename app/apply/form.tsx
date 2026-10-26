"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { fieldName, groupBySection, isVisible, latestDate, MAX_ANSWER, splitBilingual, todayInIndia, type ApplyQuestion } from "@/lib/apply-questions";
import { browserStorage, checkFile, extFor, shrinkImage } from "@/lib/upload-client";
import { startApplication, submitApplication } from "./actions";
import type { ApplyConfig } from "./config";
import { Turnstile } from "./turnstile";
import { SOURCES } from "@/lib/sources";

const SELECT = "-- Select / தேர்வு செய்க --";
const ABOUT_YOU = "About you / உங்களைப் பற்றி";
const isAboutYou = (section: string) => splitBilingual(section)[0].toLowerCase() === "about you";
// long questions get the full row so their answer box isn't squeezed
const wide = (q: ApplyQuestion) =>
  q.type === "long_text" || splitBilingual(q.label)[0].length > 42 || q.options.some((o) => o.length > 24);

type FieldError = { field?: string; message: string } | null;

/** Fixed fields (branch, post, name, mobile, father's name, marital status, email, address) feed the candidate record and
 *  letters, so they can't be removed. Everything else comes from the questions the admin manages.
 *  Files upload from the browser straight to storage; the server only receives answers and file paths. */
export function ApplyForm({ branches, questions, initialBranch, lockBranch, source }: ApplyConfig & { initialBranch?: string; lockBranch?: boolean; source?: string | null }) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [branchId, setBranchId] = useState(initialBranch ?? "");
  const [heard, setHeard] = useState(source ?? "");
  const [post, setPost] = useState("");
  const posts = branches.find((b) => b.id === branchId)?.posts ?? [];
  const [error, setError] = useState<FieldError>(null);
  const [doneRef, setDoneRef] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const towns = [...new Set(branches.map((b) => b.town))];
  const visible = questions.filter((q) => isVisible(q, choices, questions));
  const sections = groupBySection(visible);
  const aboutYou = sections.find(([s]) => isAboutYou(s))?.[1] ?? [];
  const others = sections.filter(([s]) => !isAboutYou(s));
  const errFor = (name: string) => (error?.field === name ? error.message : undefined);

  if (!branches.length) {
    return (
      <div className="py-10 text-center text-sm text-slate-600">
        <p>There are no openings right now. Please check again later.</p>
        <p>தற்போது காலியிடங்கள் இல்லை. பின்னர் மீண்டும் பார்க்கவும்.</p>
      </div>
    );
  }

  if (doneRef !== null) {
    return (
      <div className="py-10 text-center" role="status">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700" aria-hidden>✓</div>
        <h2 className="text-lg font-bold text-green-700">Application submitted</h2>
        <p className="text-sm font-semibold text-green-700">விண்ணப்பம் சமர்ப்பிக்கப்பட்டது</p>
        {doneRef && (
          <p className="mx-auto mt-4 w-fit rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm">
            Reference number / குறிப்பு எண்: <b className="font-mono text-base">{doneRef}</b>
          </p>
        )}
        <p className="mt-4 text-sm text-slate-700">Our HR team will call you within 2 working days. Please keep your phone reachable.</p>
        <p className="text-sm text-slate-700">எங்கள் HR குழு 2 வேலை நாட்களுக்குள் உங்களை அழைக்கும். உங்கள் கைபேசியை இயக்கத்தில் வைத்திருங்கள்.</p>
        <p className="mt-3 text-xs text-slate-500">Save the reference number. You can quote it when you call the branch.<br />குறிப்பு எண்ணைச் சேமித்து வைக்கவும்.</p>
      </div>
    );
  }

  const question = (q: ApplyQuestion) => (
    <Question key={q.id} q={q} value={choices[q.id] ?? ""} error={errFor(fieldName(q))} onChoose={(v) => setChoices((s) => ({ ...s, [q.id]: v }))} />
  );

  const fail = (e: FieldError) => {
    setError(e);
    setProgress("");
    setCaptcha("");
    setCaptchaKey((k) => k + 1); // a check can be used once
    const el = e?.field ? formRef.current?.elements.namedItem(e.field) : null;
    if (el instanceof HTMLElement) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (progress) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const fileQs = visible.filter((q) => q.type === "file");
    const picked = fileQs.map((q) => [q, fd.get(fieldName(q))] as const).filter((x): x is [ApplyQuestion, File] => x[1] instanceof File && x[1].size > 0);
    for (const q of questions.filter((x) => x.type === "file")) fd.delete(fieldName(q));

    setProgress("Checking… / சரிபார்க்கிறது…");
    const start = await startApplication(captcha);
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

    setProgress("Submitting… / சமர்ப்பிக்கிறது…");
    try {
      const r = await submitApplication(fd);
      if (r.ok) { setDoneRef(r.ref ?? ""); window.scrollTo({ top: 0 }); return; }
      fail({ field: r.field, message: r.message });
    } catch {
      fail({ message: "Could not submit. Please check your internet and try again. / இணையத்தைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்." });
    }
  }

  return (
    <form ref={formRef} className="space-y-5" onSubmit={onSubmit} noValidate={false}>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error.message}</div>}
      <p className="text-xs text-slate-600">Fields marked <span className="text-red-700">*</span> are required. / <span className="text-red-700">*</span> குறியிட்டவை கட்டாயம்.</p>

      <Section n={1} title="Job you are applying for / நீங்கள் விண்ணப்பிக்கும் வேலை">
        <Field label="Branch / கிளை" required wide error={errFor("branch_id")}>
          {lockBranch ? (
            <>
              <input type="hidden" name="branch_id" value={branchId} />
              <p className="input flex h-10 items-center bg-slate-50 font-semibold text-slate-800">
                {(() => { const b = branches.find((x) => x.id === branchId); return b ? `${b.name} (${b.business_type})` : ""; })()}
              </p>
            </>
          ) : (
            <select name="branch_id" className="input h-10" required value={branchId}
              onChange={(e) => { setBranchId(e.target.value); setPost(""); }}>
              <option value="">{SELECT}</option>
              {towns.map((t) => (
                <optgroup key={t} label={t}>
                  {branches.filter((b) => b.town === t).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.business_type})</option>)}
                </optgroup>
              ))}
            </select>
          )}
        </Field>
        <Field label="Post applying for / விண்ணப்பிக்கும் பதவி" required wide error={errFor("post")}>
          <select name="post" className="input h-10 disabled:bg-slate-50 disabled:text-slate-500" required disabled={!branchId} value={post} onChange={(e) => setPost(e.target.value)}>
            <option value="">{branchId ? SELECT : "Choose a branch first / முதலில் கிளையைத் தேர்வு செய்க"}</option>
            {posts.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </Section>

      <Section n={2} title={ABOUT_YOU}>
        <Field label="Full name / முழுப் பெயர்" required error={errFor("name")}><input name="name" className="input h-10" required maxLength={120} autoComplete="name" /></Field>
        <Field label="Mobile number / கைபேசி எண்" required error={errFor("mobile")}>
          <input name="mobile" className="input h-10" type="tel" inputMode="numeric" pattern="[0-9+ ]{10,14}" required autoComplete="tel" placeholder="10 digits / 10 இலக்கங்கள்" />
        </Field>
        <Field label="Father's / husband's name / தந்தை / கணவர் பெயர்" required error={errFor("father_name")}><input name="father_name" className="input h-10" required maxLength={120} /></Field>
        {aboutYou.map(question)}
        <Field label="Marital status / திருமண நிலை" required error={errFor("marital_status")}>
          <select name="marital_status" className="input h-10" required defaultValue="">
            <option value="">{SELECT}</option>
            <option value="Single">Single / திருமணம் ஆகாதவர்</option>
            <option value="Married">Married / திருமணம் ஆனவர்</option>
          </select>
        </Field>
        <Field label="Email / மின்னஞ்சல்"><input name="email" className="input h-10" type="email" maxLength={120} autoComplete="email" /></Field>
        <Field label="Address / முகவரி" required wide error={errFor("address")}><textarea name="address" className="input" rows={3} required maxLength={500} autoComplete="street-address" /></Field>
        {source ? <input type="hidden" name="source_channel" value={source} /> : (
          <Field label="How did you hear about this job? / இந்த வேலையைப் பற்றி எப்படி அறிந்தீர்கள்?">
            <select name="source_channel" className="input h-10" value={heard} onChange={(e) => setHeard(e.target.value)}>
              <option value="">{SELECT}</option>
              {Object.entries(SOURCES).filter(([k]) => k !== "poster" && k !== "careers").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        )}
        <Field label="Referred by a Balasanka employee? Their name or employee code / பரிந்துரைத்த ஊழியர் பெயர் அல்லது குறியீடு">
          <input name="referred_by" className="input h-10" maxLength={120} placeholder="Optional / விருப்பம்" />
        </Field>
      </Section>

      {others.map(([title, qs], i) => <Section key={title} n={i + 3} title={title}>{qs.map(question)}</Section>)}

      <div className={`rounded-lg border p-3 text-sm ${errFor("consent") ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
        <p className="font-semibold text-slate-800">Your privacy / உங்கள் தனியுரிமை</p>
        <p className="mt-1 text-slate-700">
          Balasanka Group uses the details and files in this form only to consider you for a job: to contact you, arrange interviews and,
          if selected, prepare your offer. Only our HR team and the store you applied to can see them. If you are not selected,
          we delete them after a fixed period. You can ask us to correct or delete your details at any time.
        </p>
        <p className="mt-1 text-slate-700">
          இந்தப் படிவத்தில் உள்ள விவரங்களையும் கோப்புகளையும் பாலசங்கா குழுமம் உங்களை வேலைக்குப் பரிசீலிக்க மட்டுமே பயன்படுத்தும்: உங்களைத்
          தொடர்பு கொள்ள, நேர்காணல் ஏற்பாடு செய்ய, தேர்வானால் பணி வாய்ப்புக் கடிதம் தயாரிக்க. எங்கள் HR குழுவும் நீங்கள் விண்ணப்பித்த
          கிளையும் மட்டுமே இவற்றைப் பார்க்க முடியும். தேர்வாகவில்லை எனில், குறிப்பிட்ட காலத்திற்குப் பிறகு இவை நீக்கப்படும். உங்கள் விவரங்களைத்
          திருத்தவோ நீக்கவோ எப்போது வேண்டுமானாலும் கேட்கலாம்.
        </p>
        <p className="mt-1"><Link href="/privacy" target="_blank" className="text-sky-800 underline">Full privacy notice and contact / முழு தனியுரிமை அறிவிப்பு</Link></p>
        <label className="mt-2 flex items-start gap-2 font-semibold text-slate-900">
          <input type="checkbox" name="consent" value="yes" required className="mt-1 h-5 w-5 shrink-0" aria-describedby={errFor("consent") ? "consent-error" : undefined} />
          <span>I agree to Balasanka Group using my details for this job application. <span className="text-red-700">*</span><br />
            <span className="font-normal">இந்த வேலை விண்ணப்பத்திற்காக என் விவரங்களைப் பயன்படுத்த ஒப்புக்கொள்கிறேன்.</span></span>
        </label>
        {errFor("consent") && <p id="consent-error" className="mt-1 text-xs text-red-700">{errFor("consent")}</p>}
      </div>

      <p className="text-xs text-slate-600">
        Photos or PDFs only, up to 5 MB each. Large photos are made smaller on your phone before upload.
        <br />புகைப்படம் அல்லது PDF மட்டும், ஒவ்வொன்றும் 5 MB வரை. பெரிய புகைப்படங்கள் தானாகச் சிறியதாக்கப்படும்.
      </p>
      <Turnstile key={captchaKey} onToken={setCaptcha} />
      <button className="btn-primary h-12 w-full text-base" disabled={!!progress} aria-live="polite">
        {progress || "Submit application / விண்ணப்பத்தைச் சமர்ப்பிக்கவும்"}
      </button>
    </form>
  );
}

function Question({ q, value, error, onChoose }: { q: ApplyQuestion; value: string; error?: string; onChoose: (v: string) => void }) {
  const name = fieldName(q);
  const field = (control: React.ReactNode) => <Field label={q.label} required={q.required} wide={wide(q)} error={error}>{control}</Field>;
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
          className="block h-10 w-full overflow-hidden rounded-md border border-slate-300 bg-white text-sm text-slate-700 file:mr-3 file:h-full file:cursor-pointer file:border-0 file:border-r file:border-slate-300 file:bg-slate-100 file:px-3 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-200" />,
      );
    case "date":
      return field(q.min_age
        ? <DateParts name={name} required={q.required} latest={latestDate(q.min_age, todayInIndia())} />
        : <input name={name} className="input h-10" type="date" required={q.required} />);
    case "number":
      return field(<input name={name} className="input h-10" inputMode="numeric" required={q.required} maxLength={MAX_ANSWER.number} />);
    default:
      return field(<input name={name} className="input h-10" required={q.required} maxLength={MAX_ANSWER.text} />);
  }
}

const MONTHS = ["Jan / ஜன", "Feb / பிப்", "Mar / மார்", "Apr / ஏப்", "May / மே", "Jun / ஜூன்", "Jul / ஜூலை", "Aug / ஆக", "Sep / செப்", "Oct / அக்", "Nov / நவ", "Dec / டிச"];

/** Day / month / year dropdowns: phones show the native date box as mm/dd/yyyy, which confuses Indian users. */
function DateParts({ name, required, latest }: { name: string; required: boolean; latest: string }) {
  const [d, setD] = useState("");
  const [m, setM] = useState("");
  const [y, setY] = useState("");
  const maxYear = Number(latest.slice(0, 4));
  const years = Array.from({ length: 60 }, (_, i) => maxYear - i);
  const value = d && m && y ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "";
  return (
    <div className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-2">
      <select className="input h-10" aria-label="Day / நாள்" required={required} value={d} onChange={(e) => setD(e.target.value)}>
        <option value="">Day</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select className="input h-10" aria-label="Month / மாதம்" required={required} value={m} onChange={(e) => setM(e.target.value)}>
        <option value="">Month</option>
        {MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
      </select>
      <select className="input h-10" aria-label="Year / ஆண்டு" required={required} value={y} onChange={(e) => setY(e.target.value)}>
        <option value="">Year</option>
        {years.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

/** English on the first line, Tamil under it, and the box pinned to the bottom so boxes in a row line up. */
function Field({ label, required, wide, error, children }: { label: string; required?: boolean; wide?: boolean; error?: string; children: React.ReactNode }) {
  const [en, ta] = splitBilingual(label);
  return (
    <label className={`flex flex-col ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 flex-1">
        <span className="block text-sm font-semibold text-slate-800">{en}{required && <span className="ml-0.5 text-red-700">*</span>}</span>
        {ta && <span className="block text-xs text-slate-600">{ta}</span>}
      </span>
      {children}
      {error && <span role="alert" className="mt-1 text-xs font-semibold text-red-700">{error}</span>}
    </label>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const [en, ta] = splitBilingual(title);
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden>{n}</span>
        <h2>
          <span className="block text-sm font-bold text-brand">{en}</span>
          {ta && <span className="block text-xs font-semibold text-slate-600">{ta}</span>}
        </h2>
      </header>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
