"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Branch, Candidate, CandidateEvent, Profile } from "@/lib/types";
import type { Categorized } from "@/lib/categorize";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getCandidateDetails, type CandidateDetails } from "@/app/actions/details";
import { eraseCandidate, renewLink } from "@/app/actions/privacy";
import { addRemark, changeBranch, completePayroll, setEmployeeDetails, setOnboardingStatus } from "@/app/actions/candidates";
import { dismissReapply, releaseReapply, sendToReapply } from "@/app/actions/workflow";
import { isAdminRole } from "@/lib/types";
import { DOC_LABELS, MANDATORY_DOCS, docLabel } from "@/lib/onboarding";
import { StageForm } from "./stage-form";
import { WaComposer } from "./wa-composer";
import { Scorecard } from "./scorecard";
import { setTalentPool } from "@/app/actions/talent";
import { sourceLabel } from "@/lib/sources";
import { Badge, Flash, Modal } from "./ui";

type Tab = "profile" | "update" | "interview" | "history" | "documents";

export function CandidatePanel({ me, c, cat, branches, appUrl, onClose }: {
  me: Profile; c: Candidate; cat: Categorized; branches: Branch[]; appUrl: string; onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(cat.active || cat.category.endsWith("joined_list") ? "update" : "profile");
  const [details, setDetails] = useState<CandidateDetails | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    getCandidateDetails(c.id).then((d) => live && setDetails(d));
    return () => { live = false; };
  }, [c.id, reload]);

  const refresh = () => { setReload((n) => n + 1); router.refresh(); };
  const branch = branches.find((b) => b.id === c.branch_id);
  const base = appUrl || (typeof window !== "undefined" ? window.location.origin : "");
  // The link token is only fetched when the candidate is opened, so it never sits in the dashboard list.
  const token = details?.accessToken;
  const offerUrl = token ? `${base}/letters/offer/${token}` : "";
  const apptUrl = token ? `${base}/letters/appointment/${token}` : "";
  const onboardUrl = token ? `${base}/onboard/${token}` : "";
  const formData = details?.formData ?? {};
  const selected = ["selected_joined", "online_joined_list", "walkin_joined_list"].includes(cat.category) || c.pipeline_status === "Joined";
  const admin = isAdminRole(me.role);
  const store = me.role === "branch";

  const tabs: [Tab, string][] = [["profile", "Profile"], ["update", "Update status"], ["interview", `Interview${details?.scores.length ? ` (${details.scores.length})` : ""}`], ["history", "History"]];
  // Onboarding documents and letters are for HR and admins only.
  if (selected && !store) tabs.push(["documents", "Onboarding & letters"]);

  return (
    <Modal open onClose={onClose} title={`${c.name} · ${c.mobile}`} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={cat.tone}>{cat.label}</Badge>
        <Badge tone={c.source === "walkin" ? "purple" : "sky"}>{c.source === "walkin" ? "Walk-in" : "Online"}</Badge>
        <span className="text-xs text-slate-500">HR: {c.assigned_hr}</span>
        <a className="btn-outline ml-auto !py-1 text-xs" href={`tel:+91${c.mobile}`}>Call</a>
        {details ? (
          <WaComposer candidateId={c.id} mobile={c.mobile} apiEnabled={details.whatsappApi} onSent={refresh}
            ctx={{ name: c.name, post: c.designation ?? c.posts[0] ?? "", branch: branch?.name ?? c.applied_locations[0] ?? "Balasanka Group", address: branch?.address ?? branch?.name ?? "", hr: me.full_name }}
            links={{ offer: offerUrl, onboarding: onboardUrl, appointment: c.pipeline_status === "Joined" ? apptUrl : "" }} />
        ) : <a className="btn-outline !py-1 text-xs" target="_blank" rel="noreferrer" href={`https://wa.me/91${c.mobile}`}>WhatsApp</a>}
      </div>
      {cat.category === "reapply" && admin && <ReapplyBox c={c} branch={branch?.name} onDone={refresh} />}
      {c.pipeline_status === "Joined" && <JoiningBox c={c} canComplete={!store} onSaved={refresh} />}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-semibold ${tab === k ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</button>
        ))}
      </div>

      {tab === "profile" && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="Received" v={formatDateTime(c.received_at)} />
          <Row k="Heard about us" v={c.source === "walkin" ? "Walk-in" : sourceLabel(c.source_channel)} />
          {c.referred_by && <Row k="Referred by" v={c.referred_by} />}
          {c.offer_response && <Row k="Offer reply" v={`${c.offer_response === "accepted" ? "Accepted" : "Declined"} online, ${formatDateTime(c.offer_responded_at)}${c.offer_decline_reason ? ` (${c.offer_decline_reason})` : ""}`} />}
          <Row k="Applied for" v={c.posts.join(", ") || "-"} />
          <Row k="Applied locations" v={c.applied_locations.join(", ") || "-"} />
          <Row k="Branch allocated" v={branch?.name ?? "-"} />
          <Row k="Designation" v={c.designation ?? "-"} />
          <Row k="Marital status" v={c.marital_status ?? "-"} />
          <Row k="Father / husband" v={c.father_name ?? "-"} />
          <Row k="Email" v={c.email ?? "-"} />
          <Row k="Address" v={c.address ?? "-"} />
          <Row k="Interview" v={formatDateTime(c.interview_at)} />
          <Row k="Salary" v={c.basic_salary ? `₹${c.basic_salary} + ₹${c.allowances}` : "-"} />
          <Row k="Expected joining" v={formatDate(c.expected_joining_date)} />
          <Row k="Actual joining" v={formatDate(c.actual_joining_date)} />
          <Row k="Next action" v={`${c.next_action ?? "-"}${c.next_action_at ? ` (${formatDateTime(c.next_action_at)})` : ""}`} />
          {Object.entries(formData).filter(([, v]) => v && !/^(https?|app-file):/.test(v)).map(([k, v]) => <Row key={k} k={k} v={v} />)}
          {Object.entries(formData).filter(([, v]) => /^https?:/.test(v)).map(([k, v]) => (
            <div key={k} className="text-sm"><dt className="text-xs font-semibold text-slate-500">{k}</dt><dd><a className="text-sky-700 underline" href={v} target="_blank" rel="noreferrer">Open file</a></dd></div>
          ))}
          {Object.entries(formData).filter(([, v]) => v?.startsWith("app-file:")).map(([k]) => (
            <div key={k} className="text-sm"><dt className="text-xs font-semibold text-slate-500">{k}</dt><dd>
              {details?.fileLinks[`form:${k}`]
                ? <a className="text-sky-700 underline" href={details.fileLinks[`form:${k}`]} target="_blank" rel="noreferrer">Open file</a>
                : <span className="text-slate-400">Loading…</span>}
            </dd></div>
          ))}
          {details && details.applications.length > 1 && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-slate-500">All applications ({details.applications.length})</dt>
              <dd className="space-y-2">
                {details.applications.map((a) => (
                  <details key={a.id} className="rounded border border-slate-200 p-2">
                    <summary className="cursor-pointer">{a.ref} · {a.post} · {branches.find((b) => b.id === a.branch_id)?.name ?? "-"} · {formatDateTime(a.submitted_at)}</summary>
                    <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {Object.entries(a.form_data ?? {}).map(([k, v]) => v?.startsWith("app-file:")
                        ? <div key={k}><dt className="text-xs font-semibold text-slate-500">{k}</dt><dd>{details.fileLinks[`app:${a.id}:${k}`] ? <a className="text-sky-700 underline" href={details.fileLinks[`app:${a.id}:${k}`]} target="_blank" rel="noreferrer">Open file</a> : "-"}</dd></div>
                        : <Row key={k} k={k} v={v} />)}
                    </dl>
                  </details>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
      {tab === "profile" && !store && c.branch_id && selected && <BranchBox c={c} branches={branches} onSaved={refresh} />}
      {tab === "profile" && admin && !cat.active && cat.category !== "reapply" && !cat.category.endsWith("joined_list") && <SendToReapply c={c} onDone={refresh} />}
      {tab === "profile" && <TalentBox c={c} onSaved={refresh} />}
      {tab === "profile" && me.role === "superadmin" && <EraseBox c={c} onErased={() => { onClose(); router.refresh(); }} />}

      {tab === "update" && <StageForm key={c.updated_at} c={c} branches={branches} admin={admin} onSaved={refresh} />}

      {tab === "interview" && <Scorecard candidateId={c.id} me={me.username} scores={details?.scores} onSaved={refresh} />}

      {tab === "history" && <History events={details?.events} candidateId={c.id} onAdded={refresh} />}

      {tab === "documents" && (
        <Documents c={c} details={details} offerUrl={offerUrl} apptUrl={apptUrl} onboardUrl={onboardUrl} onChanged={refresh} />
      )}
    </Modal>
  );
}

/** Joined: the store's employee code + shift, then HR's final payroll step. */
function JoiningBox({ c, canComplete, onSaved }: { c: Candidate; canComplete: boolean; onSaved: () => void }) {
  const [code, setCode] = useState(c.employee_code ?? "");
  const [shift, setShift] = useState(c.shift_time ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const done = !!c.payroll_completed_at;
  return (
    <div className={`mb-3 space-y-2 rounded border p-3 text-sm ${done ? "border-green-200 bg-green-50" : "border-indigo-200 bg-indigo-50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <b>Joining &amp; payroll</b>
        {done ? <Badge tone="green">Payroll completed {formatDate(c.payroll_completed_at)}{c.payroll_completed_by ? ` · ${c.payroll_completed_by}` : ""}</Badge>
          : c.store_details_at ? <Badge tone="indigo">Payroll completion pending</Badge> : <Badge tone="amber">Waiting for store: employee code &amp; shift</Badge>}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input className="input" placeholder="Employee code (biometric)" aria-label="Employee code" value={code} onChange={(e) => setCode(e.target.value)} disabled={done} />
        <input className="input" placeholder="Shift timing" aria-label="Shift timing" value={shift} onChange={(e) => setShift(e.target.value)} disabled={done} />
        {!done && <button className="btn-outline" disabled={pending} onClick={() => start(async () => { const r = await setEmployeeDetails(c.id, code, shift); setMsg(r); if (r.ok) onSaved(); })}>Save code &amp; shift</button>}
      </div>
      {canComplete && !done && c.store_details_at && (
        <button className="btn-success" disabled={pending} onClick={() => start(async () => { const r = await completePayroll(c.id); setMsg(r); if (r.ok) onSaved(); })}>Final payroll &amp; mark as completed</button>
      )}
      <Flash msg={msg} />
    </div>
  );
}

/** After selection: move the candidate to another branch (and that branch's HR). */
function BranchBox({ c, branches, onSaved }: { c: Candidate; branches: Branch[]; onSaved: () => void }) {
  const [id, setId] = useState(c.branch_id ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const hr = branches.find((b) => b.id === id)?.hr_username;
  return (
    <div className="mt-4 space-y-2 rounded border border-slate-200 p-3 text-sm">
      <b>Change allocated branch</b>
      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto flex-1" value={id} onChange={(e) => setId(e.target.value)} aria-label="Allocated branch">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className="btn-outline" disabled={pending || id === c.branch_id} onClick={() => start(async () => { const r = await changeBranch(c.id, id); setMsg(r); if (r.ok) onSaved(); })}>Change branch</button>
      </div>
      {id !== c.branch_id && hr && hr !== c.assigned_hr && <p className="text-xs text-amber-700">The candidate will move to <b>{hr}</b>.</p>}
      <Flash msg={msg} />
    </div>
  );
}

/** Re-Apply folder (admin): previous record at a glance, then enable for HR calling or keep closed. */
function ReapplyBox({ c, branch, onDone }: { c: Candidate; branch?: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const absconded = c.pipeline_status.startsWith("Left");
  return (
    <div className="mb-3 space-y-2 rounded border border-fuchsia-300 bg-fuchsia-50 p-3 text-sm">
      <b>Re-Apply folder · applied again {formatDateTime(c.reapply_at)}</b>
      <p>Previous: <b>{c.pipeline_status}</b>{c.rejection_reason ? ` (${c.rejection_reason})` : ""}.</p>
      {absconded && (
        <p>Previous employment: {c.designation ?? "-"} at {branch ?? "-"}, joined {formatDate(c.actual_joining_date)}, left {formatDate(c.relieving_date)}{c.employee_code ? `, employee code ${c.employee_code}` : ""}.</p>
      )}
      <p className="text-xs text-slate-600">The full history is in the History tab. Enabling starts them over as a new follow-up with the HR of the store they last applied to; the old record stays in History.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-success" disabled={pending} onClick={() => start(async () => { const r = await releaseReapply(c.id); setMsg(r); if (r.ok) onDone(); })}>Enable for HR calling</button>
        <button className="btn-outline" disabled={pending} onClick={() => start(async () => { const r = await dismissReapply(c.id); setMsg(r); if (r.ok) onDone(); })}>Keep closed</button>
      </div>
      <Flash msg={msg} />
    </div>
  );
}

function SendToReapply({ c, onDone }: { c: Candidate; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span>Rejected in error, or now eligible?</span>
      <button className="btn-outline !py-1 text-xs" disabled={pending} onClick={() => start(async () => { const r = await sendToReapply(c.id); setMsg(r); if (r.ok) onDone(); })}>Move to Re-Apply folder</button>
      <Flash msg={msg} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs font-semibold text-slate-500">{k}</dt><dd className="break-words">{v}</dd></div>;
}

function History({ events, candidateId, onAdded }: { events?: CandidateEvent[]; candidateId: string; onAdded: () => void }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  if (!events) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className="input" placeholder="Add a remark" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary" disabled={pending || !text.trim()} onClick={() => start(async () => { await addRemark(candidateId, text); setText(""); onAdded(); })}>Add</button>
      </div>
      {events.length === 0 && <p className="text-sm text-slate-500">No history yet.</p>}
      <ol className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="rounded border border-slate-200 p-2 text-sm">
            <div className="text-xs text-slate-500">{formatDateTime(e.created_at)} · {e.actor} · {e.stage}</div>
            {e.to_status && e.to_status !== e.from_status && <div>{e.from_status} → <b>{e.to_status}</b></div>}
            {e.remark && <div className="text-slate-700">“{e.remark}”</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Keep a promising candidate for future openings, findable from the dashboard's Talent pool list. */
function TalentBox({ c, onSaved }: { c: Candidate; onSaved: () => void }) {
  const [tags, setTags] = useState(c.talent_tags.join(", "));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const save = (on: boolean) => start(async () => { setMsg(await setTalentPool(c.id, on, tags.split(","))); onSaved(); });
  return (
    <div className="mt-4 space-y-2 rounded border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <b>Talent pool</b>
        {c.talent_pool ? <Badge tone="purple">In talent pool</Badge> : <span className="text-slate-500">Keep this person for future openings</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input !w-auto flex-1" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated: sales, english, theni" aria-label="Talent pool tags" />
        <button className="btn-outline" disabled={pending} onClick={() => save(true)}>{c.talent_pool ? "Save tags" : "Add to talent pool"}</button>
        {c.talent_pool && <button className="btn-outline" disabled={pending} onClick={() => save(false)}>Remove</button>}
      </div>
      <Flash msg={msg} />
    </div>
  );
}

/** DPDP right to erasure: removes the person completely. Typing the mobile number guards against a slip. */
function EraseBox({ c, onErased }: { c: Candidate; onErased: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  if (!open) return <div className="mt-4 border-t border-slate-200 pt-3 text-right"><button className="text-xs font-semibold text-red-700 underline" onClick={() => setOpen(true)}>Erase this person (they asked to be deleted)</button></div>;
  return (
    <div className="mt-4 space-y-2 rounded border border-red-300 bg-red-50 p-3 text-sm">
      <p><b>This cannot be undone.</b> Their details, uploaded files, onboarding form and history are deleted. Use only when the person asks to be deleted. Type their mobile number to confirm.</p>
      <div className="flex gap-2">
        <input className="input" inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={c.mobile} aria-label="Mobile number to confirm" />
        <button className="btn-danger" disabled={pending || typed.trim() !== c.mobile} onClick={() => start(async () => { const r = await eraseCandidate(c.id); setMsg(r); if (r.ok) onErased(); })}>Erase</button>
        <button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <Flash msg={msg} />
    </div>
  );
}

function Documents({ c, details, offerUrl, apptUrl, onboardUrl, onChanged }: {
  c: Candidate; details: CandidateDetails | null;
  offerUrl: string; apptUrl: string; onboardUrl: string; onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const ob = details?.onboarding;
  useEffect(() => { setMissing(ob?.missing_docs ?? []); }, [ob]);

  const wa = (label: string, url: string) =>
    `https://wa.me/91${c.mobile}?text=${encodeURIComponent(`Balasanka Group of Companies - Dear ${c.name},\n\nPlease open your ${label} here:\n${url}\n\nBest regards,\nHR Team`)}`;

  if (!details) return <p className="text-sm text-slate-500">Loading…</p>;
  const expires = new Date(details.tokenExpiresAt);
  const expired = expires.getTime() < Date.now();
  const renew = (replace: boolean) => start(async () => { setMsg(await renewLink(c.id, replace)); onChanged(); });

  return (
    <div className="space-y-4 text-sm">
      <section className={`flex flex-wrap items-center gap-2 rounded border p-2 ${expired ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
        <span>{expired ? <b>Links expired on {formatDate(details.tokenExpiresAt)}.</b> : <>Candidate links work until <b>{formatDate(details.tokenExpiresAt)}</b>.</>}</span>
        <button className="btn-outline !py-1 text-xs" disabled={pending} onClick={() => renew(false)}>Extend 60 days</button>
        <button className="btn-outline !py-1 text-xs" disabled={pending} title="Use if a link was sent to the wrong person" onClick={() => { if (confirm("Make a new link? The old link will stop working.")) renew(true); }}>Replace link</button>
      </section>
      <section className="space-y-2">
        <h3 className="font-bold">Letters</h3>
        <div className="flex flex-wrap gap-2">
          <a className="btn-outline" href={offerUrl} target="_blank" rel="noreferrer">Offer letter</a>
          <a className="btn-success" href={wa("offer letter", offerUrl)} target="_blank" rel="noreferrer">Send offer on WhatsApp</a>
          {c.pipeline_status === "Joined" && <>
            <a className="btn-outline" href={apptUrl} target="_blank" rel="noreferrer">Appointment letter</a>
            <a className="btn-success" href={wa("appointment letter", apptUrl)} target="_blank" rel="noreferrer">Send appointment on WhatsApp</a>
            <a className="btn-outline" href={apptUrl.replace("/appointment/", "/confirmation/")} target="_blank" rel="noreferrer">Confirmation letter</a>
          </>}
          {c.employment_status === "Left" && c.left_type === "With Information" && c.relieving_date &&
            <a className="btn-outline" href={apptUrl.replace("/appointment/", "/relieving/")} target="_blank" rel="noreferrer">Relieving &amp; experience letter</a>}
        </div>
        <p className="text-xs text-slate-600">Offer reply: {c.offer_response ? <b>{c.offer_response === "accepted" ? "Accepted" : "Declined"} on {formatDate(c.offer_responded_at)}</b> : "not yet answered (the candidate can accept or decline at the bottom of the offer letter)"}</p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold">Onboarding form</h3>
        {!ob && (
          <div className="flex flex-wrap gap-2">
            <span className="text-slate-600">Not submitted yet.</span>
            <a className="btn-success" href={wa("onboarding form", onboardUrl)} target="_blank" rel="noreferrer">Send onboarding link on WhatsApp</a>
            <button className="btn-outline" onClick={() => navigator.clipboard.writeText(onboardUrl)}>Copy link</button>
          </div>
        )}
        {ob && (
          <>
            <div>Status: <Badge tone={ob.status === "completed" ? "green" : ob.status === "pending" ? "amber" : "sky"}>{ob.status}</Badge> · submitted {formatDateTime(ob.submitted_at)}</div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {Object.keys(DOC_LABELS).map((key) => {
                const link = details?.fileLinks[key];
                const mandatory = MANDATORY_DOCS.includes(key);
                return (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={missing.includes(key)} onChange={(e) => setMissing((m) => e.target.checked ? [...m, key] : m.filter((x) => x !== key))} title="Mark as missing" />
                    <span className={mandatory ? "font-semibold" : ""}>{docLabel(key)}</span>
                    {link ? <a className="text-sky-700 underline" href={link} target="_blank" rel="noreferrer">view</a> : <span className="text-xs text-slate-400">not uploaded</span>}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">Tick documents that are missing or wrong, then mark as pending. The candidate can re-submit through the same link.</p>
            <dl className="grid grid-cols-2 gap-2">
              {Object.entries(ob.details ?? {}).filter(([, v]) => v).map(([k, v]) => <Row key={k} k={k.replace(/_/g, " ")} v={String(v)} />)}
            </dl>
            <div className="flex flex-wrap gap-2">
              <button className="btn-success" disabled={pending} onClick={() => start(async () => { setMsg(await setOnboardingStatus(c.id, "completed")); onChanged(); })}>Mark completed</button>
              <button className="btn-outline" disabled={pending || missing.length === 0} onClick={() => start(async () => { setMsg(await setOnboardingStatus(c.id, "pending", missing)); onChanged(); })}>Mark pending ({missing.length})</button>
              {ob.status === "pending" && <a className="btn-success" href={wa("onboarding form (please re-upload the missing documents)", onboardUrl)} target="_blank" rel="noreferrer">Ask to re-submit on WhatsApp</a>}
            </div>
          </>
        )}
        <Flash msg={msg} />
      </section>
    </div>
  );
}
