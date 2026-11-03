"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import { describeAction, describeChanges, describeTarget, formatWhen, type Change, type Refs } from "@/lib/history-format";

export type AuditRow = { id: number; at: string; actor: string; action: string; target: string | null; detail: Record<string, unknown> | null };

function ChangeLine({ c }: { c: Change }) {
  return (
    <li className="py-1">
      <span className="font-semibold text-slate-700">{c.label}:</span>{" "}
      {c.kind === "value" && <span>{c.value}</span>}
      {c.kind === "change" && (
        <span><span className="text-slate-500 line-through decoration-slate-300">{c.from}</span> <span aria-label="changed to" className="text-slate-400">→</span> <span className="font-medium">{c.to}</span></span>
      )}
      {c.kind === "list" && (
        <span>
          {c.added.length > 0 && <span className="text-emerald-700">added {c.added.join(", ")}</span>}
          {c.added.length > 0 && c.removed.length > 0 && <span className="text-slate-400"> · </span>}
          {c.removed.length > 0 && <span className="text-rose-700">removed {c.removed.join(", ")}</span>}
        </span>
      )}
    </li>
  );
}

/** Who changed what and when. Super admin only; the database refuses these rows to anyone else. */
export function ChangeHistory({ rows, refs }: { rows: AuditRow[]; refs: Refs }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-bold">Change history <span className="font-normal text-slate-500">(only you can see this)</span></h2>
      <p className="mb-2 text-xs text-slate-500">Latest 300 changes to candidates, logins, stores, the application form and posts. Click a row to see what changed.</p>
      <div className="max-h-[60vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b text-left text-slate-500"><th className="py-1">When</th><th>Who</th><th>What</th><th>On</th></tr></thead>
          <tbody>{rows.map((r) => {
            const changes = describeChanges(r.action, r.target, r.detail, refs);
            const target = describeTarget(r.action, r.target, r.detail, refs);
            const isOpen = open === r.id;
            return (
              <Fragment key={r.id}>
                <tr className={`border-b align-top ${changes.length ? "cursor-pointer hover:bg-slate-50" : ""}`} aria-expanded={changes.length ? isOpen : undefined}
                  onClick={() => changes.length && setOpen(isOpen ? null : r.id)}>
                  <td className="whitespace-nowrap py-1 pr-2">{formatWhen(r.at)}</td>
                  <td className="pr-2 font-semibold">{r.actor}</td>
                  <td className="pr-2">{describeAction(r.action)}{changes.length > 0 && <span className="text-slate-400"> {isOpen ? "▾" : "▸"} {changes.length} {changes.length === 1 ? "change" : "changes"}</span>}</td>
                  <td className="pr-2">{target.href
                    ? <Link href={target.href} className="font-medium text-brand underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>{target.label}</Link>
                    : target.label}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b bg-slate-50">
                    <td colSpan={4} className="px-3 py-2"><ul className="max-h-64 divide-y divide-slate-200 overflow-auto text-[12px]">{changes.map((c, i) => <ChangeLine key={i} c={c} />)}</ul></td>
                  </tr>
                )}
              </Fragment>
            );
          })}</tbody>
        </table>
        {!rows.length && <p className="py-4 text-center text-xs text-slate-500">No changes recorded yet.</p>}
      </div>
    </section>
  );
}
