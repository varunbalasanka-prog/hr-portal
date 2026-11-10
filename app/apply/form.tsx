"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fieldName, groupBySection, isVisible, normalizeMobile, splitBilingual, type ApplyQuestion } from "@/lib/apply-questions";
import { checkFile, extFor, unreadableMessage, uploadFailedMessage, uploadFile, usePickedFiles } from "@/lib/upload-client";
import { startApplication, submitApplication } from "./actions";
import type { ApplyConfig } from "./config";
import { Turnstile } from "./turnstile";
import { bilingualMessage, Field, Question, SELECT, Section } from "@/components/question-fields";

const ABOUT_YOU = "About you / உங்களைப் பற்றி";
const isAboutYou = (section: string) => splitBilingual(section)[0].toLowerCase() === "about you";

type FieldError = { field?: string; message: string } | null;

const BAD_MOBILE = "Please enter a valid 10-digit mobile number. / சரியான 10 இலக்க கைபேசி எண்ணை உள்ளிடவும்.";


/** Fixed fields (branch, post, name, mobile, address) feed the candidate record, so they can't be removed. Everything else
 *  comes from the questions the admin marks "apply page". Father's name, marital status, email and the rest are asked
 *  after the interview (details link) or in the onboarding form, so applicants get a 1-minute form.
 *  Files upload from the browser straight to storage; the server only receives answers and file paths. */
export function ApplyForm({ branches, questions, initialBranch, initialPost, lockBranch, source }: ApplyConfig & { initialBranch?: string; initialPost?: string; lockBranch?: boolean; source?: string | null }) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [branchId, setBranchId] = useState(initialBranch ?? "");
  const [post, setPost] = useState(initialPost ?? "");
  const posts = branches.find((b) => b.id === branchId)?.posts ?? [];
  const [error, setError] = useState<FieldError>(null);
  const [doneRef, setDoneRef] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const files = usePickedFiles();
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  // Submit stays off until the page's code has loaded, so an early tap can't send the form the plain-HTML way.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    // "invalid" doesn't bubble, so listen on the way down (capture) to swap in the bilingual message before the browser shows it.
    const form = formRef.current;
    if (!form) return;
    const onInvalid = (e: Event) => {
      const el = e.target as HTMLInputElement;
      el.setCustomValidity("");
      if (!el.validity.valid) el.setCustomValidity(bilingualMessage(el));
    };
    form.addEventListener("invalid", onInvalid, true);
    return () => form.removeEventListener("invalid", onInvalid, true);
  }, [doneRef]);
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
    const mobile = normalizeMobile(String(fd.get("mobile") ?? ""));
    if (!mobile) return fail({ field: "mobile", message: BAD_MOBILE });
    fd.set("mobile", mobile);
    const fileQs = visible.filter((q) => q.type === "file");
    const picked = fileQs.map((q) => [q, fd.get(fieldName(q))] as const).filter((x): x is [ApplyQuestion, File] => x[1] instanceof File && x[1].size > 0);
    for (const q of questions.filter((x) => x.type === "file")) fd.delete(fieldName(q));

    setProgress("Checking… / சரிபார்க்கிறது…");
    const start = await startApplication(captcha);
    if (!start.ok) return fail({ message: start.message });
    for (const [i, [q, raw]] of picked.entries()) {
      setProgress(`Uploading file ${i + 1} of ${picked.length}… / கோப்பு பதிவேற்றம் ${i + 1}/${picked.length}…`);
      const f = await files.take(fieldName(q), raw);
      if (!f) return fail({ field: fieldName(q), message: unreadableMessage(q.label) });
      const bad = checkFile(f, q.label);
      if (bad) return fail({ field: fieldName(q), message: bad });
      const path = `${start.folder}/${q.id}.${extFor(f.type)}`;
      if (!(await uploadFile("applications", path, f))) return fail({ field: fieldName(q), message: uploadFailedMessage(q.label) });
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
    <form ref={formRef} method="post" className="space-y-5" onSubmit={onSubmit} onChange={files.onChange} noValidate={false}
      onInputCapture={(e) => (e.target as HTMLInputElement).setCustomValidity?.("")}
      onChangeCapture={(e) => (e.target as HTMLInputElement).setCustomValidity?.("")}>
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
          <input name="mobile" className="input h-10" type="tel" inputMode="tel" maxLength={20} required autoComplete="tel" placeholder="10 digits / 10 இலக்கங்கள்" />
        </Field>
        {aboutYou.map(question)}
        <Field label="Address / முகவரி" required wide error={errFor("address")}><textarea name="address" className="input" rows={3} required maxLength={500} autoComplete="street-address" /></Field>
        {/* poster QR, careers and job-page links still record where the applicant came from */}
        {source && <input type="hidden" name="source_channel" value={source} />}
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

      {visible.some((q) => q.type === "file") && <p className="text-xs text-slate-600">
        Photos or PDFs only, up to 5 MB each. Large photos are made smaller on your phone before upload.
        <br />புகைப்படம் அல்லது PDF மட்டும், ஒவ்வொன்றும் 5 MB வரை. பெரிய புகைப்படங்கள் தானாகச் சிறியதாக்கப்படும்.
      </p>}
      <Turnstile key={captchaKey} onToken={setCaptcha} />
      <button className="btn-primary h-12 w-full text-base" disabled={!!progress || !ready} aria-live="polite">
        {progress || "Submit application / விண்ணப்பத்தைச் சமர்ப்பிக்கவும்"}
      </button>
    </form>
  );
}
