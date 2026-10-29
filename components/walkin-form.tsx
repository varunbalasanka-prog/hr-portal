"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Branch, Profile } from "@/lib/types";
import { addWalkin, requestWalkinApproval, type WalkinInput } from "@/app/actions/candidates";
import { todayIst } from "@/lib/dates";
import { checkWalkin, overAgeNote, type DobRule } from "@/lib/walkin";
import { latestDate } from "@/lib/apply-questions";
import { Field, Flash, Modal, Select } from "./ui";

export type WalkinPosts = { all: string[]; byBranch: Record<string, string[]> };

export function WalkinForm({ me, branches, posts, dobRule, onClose }: { me: Profile; branches: Branch[]; posts: WalkinPosts; dobRule: DobRule; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<WalkinInput>({
    name: "", mobile: "", maritalStatus: "", address: "", post: "", interviewNeeded: "Yes",
    branchId: me.role === "branch" ? me.branch_id ?? "" : "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof WalkinInput) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  // A store only ever enters walk-ins for itself; an HR for the stores they look after.
  const store = me.role === "branch" ? branches.find((b) => b.id === me.branch_id) : undefined;
  const choices = me.role === "hr" ? branches.filter((b) => b.hr_username === me.username) : branches;
  const today = todayIst();
  // Posts open at the chosen store; a store with none open still gets the full list.
  const open = posts.byBranch[f.branchId]?.length ? posts.byBranch[f.branchId] : posts.all;
  const postOptions = f.post && !open.includes(f.post) ? [...open, f.post] : open;
  const ageNote = overAgeNote(f.dateOfBirth, dobRule, today);

  const save = () => {
    const v = checkWalkin(f, dobRule);
    if (v.error !== undefined) { setMsg({ ok: false, message: v.error }); return; }
    start(async () => {
      const r = await addWalkin(f);
      if (!r.ok && r.blocked) { setBlocked(r.blocked); setMsg(null); return; }
      setMsg(r);
      if (r.ok) { router.refresh(); setTimeout(onClose, 800); }
    });
  };

  return (
    <Modal open onClose={onClose} title="Walk-in candidate entry">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Applicant name *"><input className="input" value={f.name} onChange={(e) => set("name")(e.target.value)} /></Field>
        <Field label="Mobile number *"><input className="input" type="tel" inputMode="tel" autoComplete="off" maxLength={16} placeholder="10 digits" value={f.mobile} onChange={(e) => set("mobile")(e.target.value)} /></Field>
        <Field label="Date of birth *"><input type="date" className="input" min={latestDate(100, today)} max={dobRule.minAge ? latestDate(dobRule.minAge, today) : today} value={f.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth")(e.target.value)} />
          {ageNote && <span role="status" className="mt-1 block rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">⚠ {ageNote} You can still save; HR will see this.</span>}</Field>
        <Field label="Marital status"><Select value={f.maritalStatus} onChange={set("maritalStatus")} options={["Married", "Unmarried"]} /></Field>
        {me.role === "branch" ? (
          <Field label="Branch"><input className="input bg-slate-50" value={store?.name ?? "Your store"} readOnly aria-readonly /></Field>
        ) : (
          <Field label="Branch *"><Select value={f.branchId} onChange={set("branchId")} options={choices.map((b) => ({ value: b.id, label: b.name }))} /></Field>
        )}
        <div className="sm:col-span-2"><Field label="Address"><textarea className="input" rows={2} value={f.address} onChange={(e) => set("address")(e.target.value)} /></Field></div>
        <Field label="Post applying for *"><Select value={f.post} onChange={set("post")} options={postOptions} /></Field>
        <Field label="Interview needed?"><Select value={f.interviewNeeded} onChange={set("interviewNeeded")} options={["Yes", "No"]} /></Field>
        {f.interviewNeeded === "Yes" ? (
          <Field label="Interview date & time *"><input type="datetime-local" className="input" min={`${today}T00:00`} value={f.interviewAt ?? ""} onChange={(e) => set("interviewAt")(e.target.value)} /></Field>
        ) : (
          <>
            <Field label="Proposed basic salary (₹)"><input className="input" inputMode="numeric" placeholder="e.g. 15000" value={f.basicSalary ?? ""} onChange={(e) => set("basicSalary")(e.target.value)} /></Field>
            <Field label="Proposed allowances (₹)"><input className="input" inputMode="numeric" value={f.allowances ?? ""} onChange={(e) => set("allowances")(e.target.value)} /></Field>
            <Field label="Expected joining date *"><input type="date" className="input" min={today} value={f.expectedJoiningDate ?? ""} onChange={(e) => set("expectedJoiningDate")(e.target.value)} /></Field>
          </>
        )}
        <div className="sm:col-span-2"><Field label="Remarks"><input className="input" value={f.remark ?? ""} onChange={(e) => set("remark")(e.target.value)} /></Field></div>
      </div>
      <div className="mt-3"><Flash msg={msg} /></div>
      <button className="btn-primary mt-1" disabled={pending || !!msg?.ok} onClick={save}>{pending ? "Saving…" : "Save walk-in"}</button>
      {blocked && (
        <Modal open onClose={() => setBlocked(null)} title="⚠ Walk-in blocked">
          <div className="space-y-3 text-sm">
            <p className="rounded bg-red-50 p-3 font-semibold text-red-800">{blocked}</p>
            <p>This person can&apos;t be added without an admin&apos;s approval. Send the request and tell the candidate HR will call them.</p>
            <Flash msg={msg} />
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={pending || !!msg?.ok} onClick={() => start(async () => setMsg(await requestWalkinApproval(f)))}>Ask admin to approve</button>
              <button className="btn-outline" onClick={() => { setBlocked(null); onClose(); }}>Close</button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
