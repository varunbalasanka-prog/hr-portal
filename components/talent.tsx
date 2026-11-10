"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Branch, Candidate } from "@/lib/types";
import type { Categorized } from "@/lib/categorize";
import { callBackFromPool, setTalentPool } from "@/app/actions/talent";
import { TALENT_LANGUAGES, callBackBlock, talentBlock, talentSuggestion } from "@/lib/talent";
import type { WalkinPosts } from "./walkin-form";
import { Badge, Field, Flash, Modal, Select } from "./ui";

/** The fixed tag lists HR picks from: the portal's roles, its stores and a few languages. */
export function talentTagGroups(posts: WalkinPosts, branches: Branch[]): { label: string; tags: string[] }[] {
  return [
    { label: "Good for these roles", tags: posts.all },
    { label: "Can work at", tags: branches.map((b) => b.name) },
    { label: "Speaks", tags: TALENT_LANGUAGES },
  ];
}

function TagPicker({ value, onChange, posts, branches }: { value: string[]; onChange: (v: string[]) => void; posts: WalkinPosts; branches: Branch[] }) {
  const flip = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  return (
    <div className="space-y-2">
      {talentTagGroups(posts, branches).filter((g) => g.tags.length).map((g) => (
        <div key={g.label}>
          <div className="mb-1 text-xs font-semibold text-slate-500">{g.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {g.tags.map((t) => (
              <button key={t} type="button" aria-pressed={value.includes(t)} onClick={() => flip(t)}
                className={`chip !px-2.5 !py-0.5 !text-xs ${value.includes(t) ? "chip-on" : ""}`}>{t}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Choose the store (and role) with the opening; the person starts over in follow-up with that store's HR. */
function CallBack({ c, branches, posts, onDone }: { c: Pick<Candidate, "id" | "name">; branches: Branch[]; posts: WalkinPosts; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [post, setPost] = useState("");
  const [remark, setRemark] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const roles = posts.byBranch[branchId]?.length ? posts.byBranch[branchId] : branches.find((b) => b.id === branchId)?.roles ?? posts.all;
  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>Call for a new opening</button>;
  return (
    <div className="space-y-2 rounded-lg bg-sky-50 p-3">
      <Field label="Store with the opening *">
        <Select value={branchId} onChange={(v) => { setBranchId(v); setPost(""); }} options={branches.map((b) => ({ value: b.id, label: b.name }))} />
      </Field>
      <Field label="Role"><Select value={post} onChange={setPost} options={roles} placeholder="-- Any / not sure --" /></Field>
      <Field label="Note for the HR (optional)"><input className="input" value={remark} maxLength={300} onChange={(e) => setRemark(e.target.value)} /></Field>
      <p className="text-xs text-slate-600">They go to the top of that store HR&apos;s follow-up list as a fresh start. Their old record stays in History.</p>
      <Flash msg={msg} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending || !branchId} onClick={() => start(async () => {
          const r = await callBackFromPool(c.id, c.name, branchId, post, remark);
          setMsg(r);
          if (r.ok) onDone();
        })}>{pending ? "Moving…" : "Move to follow-up"}</button>
        <button className="btn-outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

/** Talent pool box on a candidate's Profile tab: suggestion, fixed tags, call back. */
export function TalentBox({ c, scores, branches, posts, onSaved }: {
  c: Candidate; scores?: { recommendation: string }[]; branches: Branch[]; posts: WalkinPosts; onSaved: () => void;
}) {
  const [tags, setTags] = useState<string[]>(c.talent_tags);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const save = (on: boolean) => start(async () => { const r = await setTalentPool(c.id, on, tags); setMsg(r); if (r.ok) onSaved(); });
  const block = talentBlock(c);
  const why = talentSuggestion(c, scores);
  const callBlock = callBackBlock(c);
  return (
    <div className={`mt-4 space-y-3 rounded border p-3 text-sm ${why ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <b>Talent pool</b>
        {c.talent_pool ? <Badge tone="purple">In talent pool</Badge> : <span className="text-slate-500">Keep this person for future openings</span>}
      </div>
      {why && <p className="text-indigo-800">Worth keeping? {why} Tick what they are good for and add them.</p>}
      {block && !c.talent_pool ? <p className="text-slate-500">{block}</p> : (
        <>
          <TagPicker value={tags} onChange={setTags} posts={posts} branches={branches} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" disabled={pending} onClick={() => save(true)}>{c.talent_pool ? "Save tags" : "Add to talent pool"}</button>
            {c.talent_pool && <button className="btn-outline" disabled={pending} onClick={() => save(false)}>Remove</button>}
          </div>
        </>
      )}
      <Flash msg={msg} />
      {c.talent_pool && (callBlock ? <p className="text-xs text-slate-500">{callBlock}</p> : <CallBack c={c} branches={branches} posts={posts} onDone={onSaved} />)}
    </div>
  );
}

/** Another HR's talent pool person: only the basics, plus calling them back for an opening. */
export function TalentOnlyPanel({ c, cat, branches, posts, onClose }: {
  c: Candidate; cat: Categorized; branches: Branch[]; posts: WalkinPosts; onClose: () => void;
}) {
  const router = useRouter();
  const block = callBackBlock(c);
  return (
    <Modal open side onClose={onClose} title={c.name} subtitle={<>{c.mobile} · {c.posts.join(", ") || "-"}</>}>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={cat.tone} dot>{cat.label}</Badge>
          <Badge tone="purple">In talent pool</Badge>
          <span className="text-xs text-slate-500">HR: {c.assigned_hr}</span>
          <a className="btn-outline ml-auto" href={`tel:+91${c.mobile}`}>Call</a>
        </div>
        <div><span className="text-xs font-semibold text-slate-500">Applied at</span><div>{c.applied_locations.join(", ") || "-"}</div></div>
        <div>
          <span className="text-xs font-semibold text-slate-500">Tags</span>
          <div className="mt-1 flex flex-wrap gap-1.5">{c.talent_tags.length ? c.talent_tags.map((t) => <Badge key={t} tone="indigo">{t}</Badge>) : "-"}</div>
        </div>
        <p className="text-xs text-slate-500">This person belongs to {c.assigned_hr}. Ask them for the full record, or call them back below for an opening.</p>
        {block ? <p className="text-slate-500">{block}</p> : <CallBack c={c} branches={branches} posts={posts} onDone={() => { onClose(); router.refresh(); }} />}
      </div>
    </Modal>
  );
}
