"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/dates";
import { decideWalkin } from "@/app/actions/workflow";
import { Flash } from "@/components/ui";

export type WalkinRequestRow = {
  id: string; status: string; reason: string; requested_by: string; created_at: string; decided_by: string | null;
  candidate: { name: string; mobile: string } | null; branch: { name: string } | null; payload: { post?: string; interviewNeeded?: string; remark?: string };
};

/** Stores ask here to add a blacklisted, underage or absconding person as a walk-in. */
export function WalkinApprovals({ rows }: { rows: WalkinRequestRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const waiting = rows.filter((r) => r.status === "pending");
  const decide = (id: string, approve: boolean) => start(async () => { const r = await decideWalkin(id, approve); setMsg(r); if (r.ok) router.refresh(); });
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-2 text-sm font-bold">Walk-in approvals {waiting.length > 0 && <span className="rounded bg-red-600 px-1.5 text-xs text-white">{waiting.length}</span>}</h2>
      <Flash msg={msg} />
      {rows.length === 0 && <p className="text-xs text-slate-500">No requests.</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className={`rounded border p-2 text-sm ${r.status === "pending" ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
            <div><b>{r.candidate?.name ?? "-"}</b> ({r.candidate?.mobile}) at <b>{r.branch?.name}</b> for {r.payload.post || "-"}{r.payload.interviewNeeded === "Yes" ? ", interview" : ", direct joining"}</div>
            <div className="text-xs text-slate-600">Blocked because: {r.reason} · asked by {r.requested_by}, {formatDateTime(r.created_at)}{r.payload.remark ? ` · “${r.payload.remark}”` : ""}</div>
            {r.status === "pending" ? (
              <div className="mt-1.5 flex gap-2">
                <button className="btn-success !py-1 text-xs" disabled={pending} onClick={() => decide(r.id, true)}>Approve walk-in</button>
                <button className="btn-danger !py-1 text-xs" disabled={pending} onClick={() => decide(r.id, false)}>Refuse</button>
              </div>
            ) : <div className="text-xs font-semibold">{r.status === "approved" ? "Approved" : "Refused"} by {r.decided_by}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
