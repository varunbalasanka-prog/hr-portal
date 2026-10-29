"use client";
import { useState } from "react";
import type { NotificationRow, Profile } from "@/lib/types";
import { formatDateTime } from "@/lib/dates";
import type { AdminQuestion } from "@/lib/apply-questions";
import { QuestionsAdmin } from "./questions";
import { BranchPostsAdmin } from "./branch-posts";
import { StoreHrAdmin } from "./store-hr";
import { JobListingsAdmin, type OpeningRow, type RoleRow } from "./job-listings";
import { UsersAdmin } from "./users";
import { ChangeHistory, type AuditRow } from "./history";
import { PrivacyAdmin } from "./privacy";
import { WalkinAgeWarning, WalkinApprovals, type WalkinRequestRow } from "./walkins";
import type { PrivacyContact } from "@/lib/privacy";
import type { Branch } from "@/lib/types";

export function AdminPanel({ warnAge, walkins, me, people, log, questions, posts, branches, branchPosts, jobs, history, privacyContact, retentionMonths }: {
  privacyContact: PrivacyContact; retentionMonths: number | null; walkins: WalkinRequestRow[]; warnAge: number | null;
  me: Profile; history: AuditRow[] | null; people: Profile[]; log: NotificationRow[]; questions: AdminQuestion[]; posts: string[]; branches: Branch[]; branchPosts: Record<string, string[]>;
  jobs: { ready: boolean; openings: OpeningRow[]; roles: RoleRow[] };
}) {
  const pending = walkins.filter((w) => w.status === "pending").length;
  const tabs: [string, string][] = [
    ["walkins", `Walk-in approvals${pending ? ` (${pending})` : ""}`], ["posts", "Store posts"], ["storehr", "Store HR"], ["jobs", "Job listings"], ["form", "Application form"],
    ["users", "Logins"], ["privacy", "Privacy"], ["log", "Notification log"], ...(history ? [["history", "Change history"] as [string, string]] : []),
  ];
  const [tab, setTab] = useState(pending ? "walkins" : "posts");
  return (
    <div className="px-4 sm:px-6">
      <div className="scroll-thin mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${tab === k ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</button>
        ))}
      </div>
      {tab === "walkins" && <><WalkinAgeWarning age={warnAge} /><WalkinApprovals rows={walkins} /></>}
      {tab === "history" && history && <ChangeHistory rows={history} />}
      {tab === "posts" && <BranchPostsAdmin branches={branches} posts={posts} open={branchPosts} />}
      {tab === "storehr" && <StoreHrAdmin branches={branches} people={people} />}
      {tab === "jobs" && <JobListingsAdmin {...jobs} branches={branches} posts={posts} />}
      {tab === "form" && <QuestionsAdmin questions={questions} posts={posts} />}
      {tab === "users" && <UsersAdmin me={me} people={people} branches={branches} />}
      {tab === "privacy" && <PrivacyAdmin contact={privacyContact} months={retentionMonths} />}
      {tab === "log" && (
        <section className="card p-4 sm:p-5">
          <h2 className="mb-1 text-sm font-bold">Notification log &amp; read tracking</h2>
          <p className="mb-3 text-xs text-slate-500">Every message sent inside the portal, and whether the person has opened it.</p>
          {log.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No messages sent yet.</p>}
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">When</th><th>From → To</th><th>Message</th><th>Read</th></tr></thead>
              <tbody>{log.map((n) => (
                <tr key={n.id} className="border-b border-slate-100 align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-slate-500">{formatDateTime(n.created_at)}</td>
                  <td className="pr-3">{n.sender} → {n.recipient}</td>
                  <td className="pr-3">{n.message}</td>
                  <td className="whitespace-nowrap text-xs">{n.viewed_at ? <span className="text-emerald-700">✓ {formatDateTime(n.viewed_at)}</span> : <span className="text-red-600">unread</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
