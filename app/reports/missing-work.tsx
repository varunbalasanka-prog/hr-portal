"use client";
import { useMemo, useState } from "react";
import { formatDate, formatDateTime } from "@/lib/dates";

export type MissedRow = { day: string; hr: string; candidate: string; task: string; due_at: string | null; status: string | null };

/** Admin only: Today's Work tasks HR didn't finish on time. Recorded every night at 11:55 pm IST; "Overdue now" is live. */
export function MissingWork({ rows, now, hrs }: { rows: MissedRow[]; now: MissedRow[]; hrs: string[] }) {
  const [hr, setHr] = useState("");
  const [view, setView] = useState<"now" | "history">("now");
  const list = useMemo(() => (view === "now" ? now : rows).filter((r) => !hr || r.hr === hr), [view, now, rows, hr]);
  const perHr = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.hr, (m.get(r.hr) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  return (
    <section className="card mx-4 mb-4 p-4 sm:mx-6 sm:p-5">
      <h2 className="text-sm font-bold">Missing work</h2>
      <p className="mb-2 text-xs text-slate-600">Tasks from Today&apos;s Work that were still not updated at the end of their due day. Last 90 days.</p>
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        {perHr.map(([h, n]) => <span key={h} className="rounded border border-slate-300 px-2 py-0.5"><b>{h}</b>: {n} missed</span>)}
        {perHr.length === 0 && <span className="text-slate-500">Nothing recorded yet (the first record is made tonight at 11:55 pm).</span>}
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <button className={view === "now" ? "btn-primary" : "btn-outline"} onClick={() => setView("now")}>Overdue now ({now.length})</button>
        <button className={view === "history" ? "btn-primary" : "btn-outline"} onClick={() => setView("history")}>Missed by day ({rows.length})</button>
        <select className="input !w-auto" value={hr} onChange={(e) => setHr(e.target.value)} aria-label="HR">
          <option value="">All HR</option>
          {hrs.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b text-left text-slate-500"><th className="py-1 pr-2">Date</th><th className="pr-2">HR</th><th className="pr-2">Candidate</th><th className="pr-2">Pending task</th><th>Due</th></tr></thead>
          <tbody>{list.map((r, i) => (
            <tr key={i} className="border-b align-top">
              <td className="whitespace-nowrap py-1 pr-2">{formatDate(r.day)}</td>
              <td className="pr-2">{r.hr}</td>
              <td className="pr-2">{r.candidate}</td>
              <td className="pr-2">{r.task}{r.status ? <span className="text-slate-500"> · {r.status}</span> : null}</td>
              <td className="whitespace-nowrap">{formatDateTime(r.due_at)}</td>
            </tr>
          ))}</tbody>
        </table>
        {list.length === 0 && <p className="py-3 text-center text-xs text-slate-500">Nothing here.</p>}
      </div>
    </section>
  );
}
