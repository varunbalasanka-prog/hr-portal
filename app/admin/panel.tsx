"use client";
import type { NotificationRow, Profile } from "@/lib/types";
import { formatDateTime } from "@/lib/dates";
import type { AdminQuestion } from "@/lib/apply-questions";
import { QuestionsAdmin } from "./questions";
import { BranchPostsAdmin } from "./branch-posts";
import { UsersAdmin } from "./users";
import { ChangeHistory, type AuditRow } from "./history";
import { PrivacyAdmin } from "./privacy";
import type { PrivacyContact } from "@/lib/privacy";
import type { Branch } from "@/lib/types";

export function AdminPanel({ me, people, log, questions, posts, branches, branchPosts, history, privacyContact, retentionMonths }: {
  privacyContact: PrivacyContact; retentionMonths: number | null;
  me: Profile; history: AuditRow[] | null; people: Profile[]; log: NotificationRow[]; questions: AdminQuestion[]; posts: string[]; branches: Branch[]; branchPosts: Record<string, string[]>;
}) {
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      {history && <ChangeHistory rows={history} />}
      <BranchPostsAdmin branches={branches} posts={posts} open={branchPosts} />
      <QuestionsAdmin questions={questions} posts={posts} />
      <UsersAdmin me={me} people={people} branches={branches} />
      <PrivacyAdmin contact={privacyContact} months={retentionMonths} />
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
