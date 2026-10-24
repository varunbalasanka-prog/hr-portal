"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Branch, Profile } from "@/lib/types";
import { addWalkin, requestWalkinApproval, type WalkinInput } from "@/app/actions/candidates";
import { Field, Flash, Modal, Select } from "./ui";

export function WalkinForm({ me, branches, onClose }: { me: Profile; branches: Branch[]; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<WalkinInput>({
    name: "", mobile: "", maritalStatus: "", address: "", post: "", interviewNeeded: "Yes",
    branchId: me.role === "branch" ? me.branch_id ?? "" : "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof WalkinInput) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Modal open onClose={onClose} title="Walk-in candidate entry">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Applicant name *"><input className="input" value={f.name} onChange={(e) => set("name")(e.target.value)} /></Field>
        <Field label="Mobile number *"><input className="input" inputMode="tel" value={f.mobile} onChange={(e) => set("mobile")(e.target.value)} /></Field>
        <Field label="Marital status"><Select value={f.maritalStatus} onChange={set("maritalStatus")} options={["Married", "Unmarried"]} /></Field>
        <Field label="Branch *"><Select value={f.branchId} onChange={set("branchId")} options={branches.map((b) => ({ value: b.id, label: b.name }))} /></Field>
        <div className="sm:col-span-2"><Field label="Address"><textarea className="input" rows={2} value={f.address} onChange={(e) => set("address")(e.target.value)} /></Field></div>
        <Field label="Post applying for *"><input className="input" value={f.post} onChange={(e) => set("post")(e.target.value)} /></Field>
        <Field label="Interview needed?"><Select value={f.interviewNeeded} onChange={set("interviewNeeded")} options={["Yes", "No"]} /></Field>
        {f.interviewNeeded === "Yes" ? (
          <Field label="Interview date & time *"><input type="datetime-local" className="input" value={f.interviewAt ?? ""} onChange={(e) => set("interviewAt")(e.target.value)} /></Field>
        ) : (
          <>
            <Field label="Basic salary (₹)"><input className="input" inputMode="numeric" value={f.basicSalary ?? ""} onChange={(e) => set("basicSalary")(e.target.value)} /></Field>
            <Field label="Allowances (₹)"><input className="input" inputMode="numeric" value={f.allowances ?? ""} onChange={(e) => set("allowances")(e.target.value)} /></Field>
            <Field label="Expected joining date *"><input type="date" className="input" value={f.expectedJoiningDate ?? ""} onChange={(e) => set("expectedJoiningDate")(e.target.value)} /></Field>
          </>
        )}
        <div className="sm:col-span-2"><Field label="Remarks"><input className="input" value={f.remark ?? ""} onChange={(e) => set("remark")(e.target.value)} /></Field></div>
      </div>
      <div className="mt-3"><Flash msg={msg} /></div>
      <button className="btn-primary mt-1" disabled={pending} onClick={() => start(async () => {
        const r = await addWalkin(f);
        if (!r.ok && r.blocked) { setBlocked(r.blocked); setMsg(null); return; }
        setMsg(r);
        if (r.ok) { router.refresh(); setTimeout(onClose, 800); }
      })}>{pending ? "Saving…" : "Save walk-in"}</button>
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
