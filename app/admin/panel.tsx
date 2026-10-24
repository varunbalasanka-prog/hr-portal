"use client";
import { useState, useTransition } from "react";
import type { NotificationRow, Profile } from "@/lib/types";
import { formatDateTime } from "@/lib/dates";
import { adminResetPassword } from "@/app/actions/users";
import { Badge, Flash } from "@/components/ui";
import type { AdminQuestion } from "@/lib/apply-questions";
import { QuestionsAdmin } from "./questions";

export function AdminPanel({ people, log, questions, posts }: { people: Profile[]; log: NotificationRow[]; questions: AdminQuestion[]; posts: string[] }) {
  const [pw, setPw] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <QuestionsAdmin questions={questions} posts={posts} />
      <section className="card p-3">
        <h2 className="mb-2 text-sm font-bold">Reset passwords</h2>
        <Flash msg={msg} />
        <table className="w-full text-sm">
          <tbody>{people.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="py-1.5"><b>{p.username}</b> <Badge tone={p.role === "admin" ? "red" : p.role === "hr" ? "sky" : "slate"}>{p.role}</Badge></td>
              <td className="w-40"><input type="password" className="input" placeholder="New password" value={pw[p.id] ?? ""} onChange={(e) => setPw((s) => ({ ...s, [p.id]: e.target.value }))} /></td>
              <td className="w-20 pl-2"><button className="btn-outline" disabled={pending || !pw[p.id]} onClick={() => start(async () => { setMsg(await adminResetPassword(p.id, pw[p.id])); setPw((s) => ({ ...s, [p.id]: "" })); })}>Reset</button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="card p-3">
        <h2 className="mb-2 text-sm font-bold">Notification log &amp; read tracking</h2>
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-left text-slate-500"><th>When</th><th>From → To</th><th>Message</th><th>Read</th></tr></thead>
            <tbody>{log.map((n) => (
              <tr key={n.id} className="border-b align-top">
                <td className="py-1 pr-2 whitespace-nowrap">{formatDateTime(n.created_at)}</td>
                <td className="pr-2">{n.sender} → {n.recipient}</td>
                <td className="pr-2">{n.message}</td>
                <td>{n.viewed_at ? <span className="text-green-700">✓ {formatDateTime(n.viewed_at)}</span> : <span className="text-red-600">unread</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
