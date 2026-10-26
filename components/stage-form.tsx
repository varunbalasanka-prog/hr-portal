"use client";
import { useState, useTransition } from "react";
import { CALL_OUTCOMES, SCREENING_REJECTION_REASONS, STAGE_TITLES, stageFor, type StageInput } from "@/lib/pipeline";
import { formatDate, formatDateTime } from "@/lib/dates";
import { calculateSalary, rupees } from "@/lib/salary";
import type { Branch, Candidate } from "@/lib/types";
import { reactivateCandidate, updateCandidateStage } from "@/app/actions/candidates";
import { Field, Flash, Select } from "./ui";

export function StageForm({ c, branches, admin, onSaved }: { c: Candidate; branches: Branch[]; admin: boolean; onSaved: () => void }) {
  const stage = stageFor(c);
  // A held candidate already attended; only the admin's decision is left.
  const onHold = c.pipeline_status === "Waiting for Admin Approval";
  const firstApplied = branches.find((b) => b.name === c.applied_locations[0])?.id ?? "";
  const [f, setF] = useState<StageInput>({
    attendance: onHold ? "Attended" : undefined,
    interviewBranchId: c.branch_id ?? firstApplied,
    basicSalary: String(c.proposed_basic ?? (c.basic_salary || "")),
    allowances: String(c.proposed_allowances ?? (c.allowances || "")),
    branchId: c.branch_id ?? branches.find((b) => b.name === c.applied_locations[0])?.id ?? "",
    designation: c.designation ?? c.posts[0] ?? "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof StageInput>(k: K) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => start(async () => {
    const r = await updateCandidateStage(c.id, f);
    setMsg(r);
    if (r.ok) onSaved();
  });

  if (stage === "closed") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">This candidate is closed: <b>{c.pipeline_status}</b>{c.rejection_reason ? ` (${c.rejection_reason})` : ""}.</p>
        <Flash msg={msg} />
        {admin ? (
          <button className="btn-outline" disabled={pending} onClick={() => start(async () => { const r = await reactivateCandidate(c.id); setMsg(r); if (r.ok) onSaved(); })}>
            Reopen follow-up (admin)
          </button>
        ) : <p className="text-xs text-slate-500">Closed by mistake? Ask an admin to reopen it.</p>}
      </div>
    );
  }

  const branchOptions = branches.map((b) => ({ value: b.id, label: b.name }));
  // Stores the candidate applied to come first in the interview location list.
  const interviewOptions = [
    ...branches.filter((b) => c.applied_locations.includes(b.name)).map((b) => ({ value: b.id, label: `${b.name} (applied)` })),
    ...branches.filter((b) => !c.applied_locations.includes(b.name)).map((b) => ({ value: b.id, label: b.name })),
  ];
  const interviewHr = branches.find((b) => b.id === f.interviewBranchId)?.hr_username;
  const selectionFields = (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-green-200 bg-green-50 p-3 sm:grid-cols-2">
      <Field label="Branch allocated *"><Select value={f.branchId ?? ""} onChange={set("branchId")} options={branchOptions} /></Field>
      <Field label="Designation"><input className="input" value={f.designation ?? ""} onChange={(e) => set("designation")(e.target.value)} /></Field>
      <Field label="Proposed basic salary (₹)"><input className="input" inputMode="numeric" value={f.basicSalary ?? ""} onChange={(e) => set("basicSalary")(e.target.value)} /></Field>
      <Field label="Proposed allowances (₹)"><input className="input" inputMode="numeric" value={f.allowances ?? ""} onChange={(e) => set("allowances")(e.target.value)} /></Field>
      <Field label="Expected joining date *"><input type="date" className="input" value={f.expectedJoiningDate ?? ""} onChange={(e) => set("expectedJoiningDate")(e.target.value)} /></Field>
      <SalaryPreview basic={f.basicSalary} allowances={f.allowances} />
      {!admin && <p className="text-xs text-slate-600 sm:col-span-2">The salary goes to an admin for approval. The offer letter opens once it is approved.</p>}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wide text-amber-700">{STAGE_TITLES[stage]}</div>

      {(stage === "initial" || stage.endsWith("_retry")) && (
        <>
          <Field label="Call outcome *"><Select value={f.callOutcome ?? ""} onChange={set("callOutcome")} options={CALL_OUTCOMES} /></Field>
          {f.callOutcome === "Contacted" && (
            <Field label="Action *"><Select value={f.callAction ?? ""} onChange={set("callAction")} options={["Interview Scheduled", "Rejected"]} /></Field>
          )}
          {f.callOutcome === "Contacted" && f.callAction === "Interview Scheduled" && (
            <>
              <Field label="Interview date & time *"><input type="datetime-local" className="input" value={f.interviewAt ?? ""} onChange={(e) => set("interviewAt")(e.target.value)} /></Field>
              <Field label="Interview location *"><Select value={f.interviewBranchId ?? ""} onChange={set("interviewBranchId")} options={interviewOptions} /></Field>
              {interviewHr && interviewHr !== c.assigned_hr && <p className="text-xs text-amber-700">Saving moves this candidate to <b>{interviewHr}</b>, the HR for that store.</p>}
            </>
          )}
          {f.callOutcome === "Contacted" && f.callAction === "Rejected" && (
            <Field label="Rejection reason *"><Select value={f.rejectionReason ?? ""} onChange={set("rejectionReason")} options={SCREENING_REJECTION_REASONS} /></Field>
          )}
          {f.callOutcome && !["Contacted", "Wrong Number"].includes(f.callOutcome) && (
            <p className="text-xs text-slate-500">After saving, they appear in Today&apos;s SMS list with the message ready.</p>
          )}
        </>
      )}

      {(stage === "interview" || stage === "interview_rescheduled") && (
        <>
          <p className="text-xs text-slate-600">Interview: <b>{formatDateTime(c.interview_at)}</b>{stage === "interview_rescheduled" && c.reschedule_at ? <> · Rescheduled: <b>{formatDateTime(c.reschedule_at)}</b></> : null}</p>
          {onHold
            ? <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">On hold after the interview, waiting for the admin&apos;s decision. Pick Selected or Not Selected once it is decided.</p>
            : <Field label="Attendance *"><Select value={f.attendance ?? ""} onChange={set("attendance")} options={["Attended", "Not Attended"]} /></Field>}
          {f.attendance === "Attended" && (
            <Field label="Interview result *"><Select value={f.interviewStatus ?? ""} onChange={set("interviewStatus")} options={[{ value: "Selected", label: "Selected" }, { value: "Not Selected", label: "Not Selected" }, { value: "Hold", label: "Hold (waiting for admin approval)" }]} /></Field>
          )}
          {f.attendance === "Attended" && f.interviewStatus === "Selected" && selectionFields}
          {f.attendance === "Attended" && f.interviewStatus === "Not Selected" && (
            <Field label="Reason *"><Select value={f.notSelectedReason ?? ""} onChange={set("notSelectedReason")} options={["Not Suitable", "Dropped by Candidate"]} /></Field>
          )}
          {stage === "interview" && f.attendance === "Not Attended" && (
            <Field label="Not attended reason *"><Select value={f.notAttendedReason ?? ""} onChange={set("notAttendedReason")} options={["No Response", "Interview Rescheduled", "Unreachable", "Not Interested"]} /></Field>
          )}
          {stage === "interview" && f.attendance === "Not Attended" && f.notAttendedReason === "Interview Rescheduled" && (
            <Field label="New interview date & time *"><input type="datetime-local" className="input" value={f.rescheduleAt ?? ""} onChange={(e) => set("rescheduleAt")(e.target.value)} /></Field>
          )}
          {stage === "interview_rescheduled" && f.attendance === "Not Attended" && <p className="text-xs text-red-700">The candidate will be marked as dropped.</p>}
        </>
      )}

      {stage === "interview_reminder" && (
        <>
          <p className="text-xs text-slate-600">Interview was: <b>{formatDateTime(c.interview_at)}</b></p>
          <Field label="Reminder outcome *"><Select value={f.reminderStatus ?? ""} onChange={set("reminderStatus")} options={["Interview Rescheduled", "Unreachable"]} /></Field>
          {f.reminderStatus === "Interview Rescheduled" && (
            <Field label="New interview date & time *"><input type="datetime-local" className="input" value={f.rescheduleAt ?? ""} onChange={(e) => set("rescheduleAt")(e.target.value)} /></Field>
          )}
        </>
      )}

      {stage === "joining" && (
        <>
          <p className="text-xs text-slate-600">Expected joining: <b>{formatDate(c.expected_joining_date)}</b></p>
          <Field label="Joining status *"><Select value={f.joiningStatus ?? ""} onChange={set("joiningStatus")} options={["Joined", "Not Joined"]} /></Field>
          {f.joiningStatus === "Joined" && (
            <Field label="Actual joining date *"><input type="date" className="input" value={f.actualJoiningDate ?? ""} onChange={(e) => set("actualJoiningDate")(e.target.value)} /></Field>
          )}
          {f.joiningStatus === "Not Joined" && (
            <Field label="Reason *"><Select value={f.notJoinedReason ?? ""} onChange={set("notJoinedReason")} options={["Revised Joining", "Candidate Dropped"]} /></Field>
          )}
          {f.joiningStatus === "Not Joined" && f.notJoinedReason === "Revised Joining" && (
            <Field label="Revised joining date *"><input type="date" className="input" value={f.revisedJoiningDate ?? ""} onChange={(e) => set("revisedJoiningDate")(e.target.value)} /></Field>
          )}
        </>
      )}

      {stage === "revised_joining" && (
        <>
          <p className="text-xs text-slate-600">Expected: <b>{formatDate(c.expected_joining_date)}</b> · Revised: <b>{formatDate(c.revised_joining_date)}</b></p>
          <Field label="Revised joining status *"><Select value={f.revisedJoiningStatus ?? ""} onChange={set("revisedJoiningStatus")} options={["Joined", "Not Joined"]} /></Field>
          {f.revisedJoiningStatus === "Joined" && (
            <Field label="Actual joining date *"><input type="date" className="input" value={f.actualJoiningDate ?? ""} onChange={(e) => set("actualJoiningDate")(e.target.value)} /></Field>
          )}
        </>
      )}

      {stage === "employment" && (
        <>
          <p className="text-xs text-slate-600">Joined on <b>{formatDate(c.actual_joining_date)}</b></p>
          <Field label="Employment status"><Select value={f.employmentStatus ?? "Working"} onChange={set("employmentStatus")} options={[{ value: "Working", label: "Working (active)" }, { value: "Left", label: "Left / relieved" }]} placeholder="Working (active)" /></Field>
          {f.employmentStatus === "Left" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Left type *"><Select value={f.leftType ?? ""} onChange={set("leftType")} options={[{ value: "With Information", label: "With information (re-apply allowed)" }, { value: "Without Information", label: "Without information (blacklisted)" }]} /></Field>
              <Field label="Relieving date"><input type="date" className="input" value={f.relievingDate ?? ""} onChange={(e) => set("relievingDate")(e.target.value)} /></Field>
            </div>
          )}
        </>
      )}

      <Field label="Remarks"><textarea className="input" rows={2} value={f.remark ?? ""} onChange={(e) => set("remark")(e.target.value)} /></Field>
      <Flash msg={msg} />
      <button className="btn-primary" disabled={pending} onClick={submit}>{pending ? "Saving…" : "Save update"}</button>
    </div>
  );
}

function SalaryPreview({ basic, allowances }: { basic?: string; allowances?: string }) {
  const s = calculateSalary(basic ?? 0, allowances ?? 0);
  if (!s.gross) return null;
  return (
    <div className="text-xs text-slate-700 sm:col-span-2">
      Gross ₹{rupees(s.gross)} · ESI −₹{rupees(s.esiEmployee)} · PF −₹{rupees(s.pfEmployee)} · <b>Take home ₹{rupees(s.takeHome)}</b> · CTC ₹{rupees(s.totalCtc)}
    </div>
  );
}

