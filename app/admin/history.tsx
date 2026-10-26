"use client";
import { Fragment, useState } from "react";
import { formatDateTime } from "@/lib/dates";

export type AuditRow = { id: number; at: string; actor: string; action: string; target: string | null; detail: Record<string, unknown> | null };

const ACTIONS: Record<string, string> = {
  "password reset": "Reset password",
  "profiles insert": "Added login", "profiles update": "Changed login", "profiles delete": "Removed login",
  "application_questions insert": "Added question", "application_questions update": "Changed question", "application_questions delete": "Deleted question",
  "app_settings insert": "Set", "app_settings update": "Changed", "app_settings delete": "Cleared",
  "branches insert": "Added store", "branches update": "Changed store", "branches delete": "Removed store",
  "candidates delete": "Deleted candidate",
};
const SETTING: Record<string, string> = { apply_posts: "post list", branch_posts: "posts open at stores" };

/** Who changed what and when. Super admin only; the database refuses these rows to anyone else. */
export function ChangeHistory({ rows }: { rows: AuditRow[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-bold">Change history <span className="font-normal text-slate-500">(only you can see this)</span></h2>
      <p className="mb-2 text-xs text-slate-500">Latest 300 changes to logins, stores, the application form and posts. Click a row for the details.</p>
      <div className="max-h-[60vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b text-left text-slate-500"><th className="py-1">When</th><th>Who</th><th>What</th><th>On</th></tr></thead>
          <tbody>{rows.map((r) => (
            <Fragment key={r.id}>
              <tr className="cursor-pointer border-b align-top hover:bg-slate-50" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <td className="whitespace-nowrap py-1 pr-2">{formatDateTime(r.at)}</td>
                <td className="pr-2 font-semibold">{r.actor}</td>
                <td className="pr-2">{ACTIONS[r.action] ?? r.action}{r.detail && " ▸"}</td>
                <td className="pr-2">{r.action.startsWith("app_settings") ? SETTING[r.target ?? ""] ?? r.target : r.target}</td>
              </tr>
              {open === r.id && r.detail && (
                <tr className="border-b bg-slate-50">
                  <td colSpan={4} className="p-2"><pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(r.detail, null, 2)}</pre></td>
                </tr>
              )}
            </Fragment>
          ))}</tbody>
        </table>
        {!rows.length && <p className="py-4 text-center text-xs text-slate-500">No changes recorded yet.</p>}
      </div>
    </section>
  );
}
