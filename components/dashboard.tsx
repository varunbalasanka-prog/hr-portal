"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Branch, Candidate, NotificationRow, OnboardingSubmission, Profile } from "@/lib/types";
import { countAll, isTodaysWork, needsTomorrowReminder, type Categorized } from "@/lib/categorize";
import { formatDate, formatDateTime } from "@/lib/dates";
import { logout } from "@/app/login/actions";
import { updateMyProfile } from "@/app/actions/users";
import { CandidatePanel } from "./candidate-panel";
import { WalkinForm } from "./walkin-form";
import { NotificationBell, SendNotification } from "./notifications";
import { Badge, Field, Flash, Modal } from "./ui";

type Row = { c: Candidate; cat: Categorized; onboarding: OnboardingSubmission | null };

type Filter =
  | { kind: "followup"; sub?: "received" | "interview_scheduled" | "selected_joined" | "not_contacted" }
  | { kind: "completed"; sub?: "online_joined_list" | "walkin_joined_list" }
  | { kind: "rejected"; sub?: "screening_rejected" | "wrong_number" | "not_contactable" | "candidate_dropped" | "joined_left" }
  | { kind: "docs"; sub: string }
  | { kind: "today" }
  | { kind: "reminders" };

const FILTER_TITLES: Record<string, string> = {
  followup: "In follow-up", completed: "Completed", rejected: "Rejected / dropped", today: "Today's work", reminders: "Tomorrow's reminders",
  received: "New / not started", interview_scheduled: "Interview scheduled", selected_joined: "Expected joining", not_contacted: "Unreachable / retry",
  online_joined_list: "Online joined", walkin_joined_list: "Walk-in joined",
  screening_rejected: "Screening rejected", wrong_number: "Wrong number", not_contactable: "Not contactable", candidate_dropped: "Candidate dropped", joined_left: "Joined & left",
  joined_docs_received: "Docs submitted · joined", not_joined_docs_received: "Docs submitted · expected joining",
  joined_docs_pending: "Docs pending · joined", not_joined_docs_pending: "Docs pending · expected joining",
  joined_docs_not_submitted: "Docs not submitted · joined", not_joined_docs_not_submitted: "Docs not submitted · expected joining",
};

function matches(r: Row, f: Filter): boolean {
  switch (f.kind) {
    case "followup": return r.cat.active && (!f.sub || r.cat.category === f.sub);
    case "completed": return r.cat.category === "online_joined_list" || r.cat.category === "walkin_joined_list" ? (!f.sub || r.cat.category === f.sub) : false;
    case "rejected": return !r.cat.active && !r.cat.category.endsWith("joined_list") && (!f.sub || r.cat.category === f.sub);
    case "docs": return r.cat.docCategory === f.sub;
    case "today": return isTodaysWork(r.c, r.cat);
    case "reminders": return needsTomorrowReminder(r.c, r.cat);
  }
}

export function Dashboard({ me, photoUrl, rows, branches, people, notifications, appUrl }: {
  me: Profile; photoUrl: string | null; rows: Row[]; branches: Branch[]; people: Profile[]; notifications: NotificationRow[]; appUrl: string;
}) {
  const [filter, setFilter] = useState<Filter>({ kind: "followup" });
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [modal, setModal] = useState<"walkin" | "notify" | "settings" | null>(null);
  const counts = useMemo(() => countAll(rows.map((r) => r.cat)), [rows]);
  const todayCount = useMemo(() => rows.filter((r) => isTodaysWork(r.c, r.cat)).length, [rows]);
  const reminderCount = useMemo(() => rows.filter((r) => needsTomorrowReminder(r.c, r.cat)).length, [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle) {
      return rows.filter((r) => [r.c.name, r.c.mobile, r.c.posts.join(" "), r.c.applied_locations.join(" "), r.cat.label].join(" ").toLowerCase().includes(needle));
    }
    return rows.filter((r) => matches(r, filter));
  }, [rows, filter, q]);

  const open = rows.find((r) => r.c.id === openId);
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name;
  const title = q ? `Search: “${q}”` : FILTER_TITLES[("sub" in filter && filter.sub) || filter.kind];

  return (
    <div className="pb-20 sm:pb-6">
      <header className="flex items-center justify-between border-b-2 border-brand-accent bg-white px-4 py-2">
        <div>
          <div className="font-serif text-base font-extrabold uppercase tracking-wide sm:text-lg">Balasanka Group of Companies</div>
          <div className="hidden text-[10px] font-semibold text-slate-500 sm:block">Theni • Madurai • Virudhunagar • Sivakasi • Srivilliputhur • Rajapalayam • Tenkasi • Tirunelveli</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/balasanka_logo.png" alt="" className="h-9 w-auto" />
      </header>

      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur">
        <Menu label={`In follow-up (${counts.in_followup})`} tone="text-sky-700" onPick={(sub) => setFilter({ kind: "followup", sub: sub as never })} items={[
          ["", `All (${counts.in_followup})`], ["received", `New / not started (${counts.received})`], ["interview_scheduled", `Interview scheduled (${counts.interview_scheduled})`],
          ["selected_joined", `Expected joining (${counts.selected_joined})`], ["not_contacted", `Unreachable / retry (${counts.not_contacted})`],
        ]} />
        <Menu label={`Completed (${counts.completed})`} tone="text-green-700" onPick={(sub) => setFilter({ kind: "completed", sub: sub as never })} items={[
          ["", `All (${counts.completed})`], ["online_joined_list", `Online joined (${counts.online_joined_list})`], ["walkin_joined_list", `Walk-in joined (${counts.walkin_joined_list})`],
        ]} />
        <Menu label={`Rejected (${counts.rejected})`} tone="text-red-700" onPick={(sub) => setFilter({ kind: "rejected", sub: sub as never })} items={[
          ["", `All (${counts.rejected})`], ["screening_rejected", `Screening rejected (${counts.screening_rejected})`], ["wrong_number", `Wrong number (${counts.wrong_number})`],
          ["not_contactable", `Not contactable (${counts.not_contactable})`], ["candidate_dropped", `Candidate dropped (${counts.candidate_dropped})`], ["joined_left", `Joined & left (${counts.joined_left})`],
        ]} />
        <Menu label="Onboarding" tone="text-teal-700" onPick={(sub) => setFilter({ kind: "docs", sub })} items={[
          ["joined_docs_received", "Submitted · joined"], ["not_joined_docs_received", "Submitted · expected joining"],
          ["joined_docs_pending", "Pending · joined"], ["not_joined_docs_pending", "Pending · expected joining"],
          ["joined_docs_not_submitted", "Not submitted · joined"], ["not_joined_docs_not_submitted", "Not submitted · expected joining"],
        ]} />
        <button className="btn-outline" onClick={() => setFilter({ kind: "today" })}>Today ({todayCount})</button>
        <button className="btn-outline" onClick={() => setFilter({ kind: "reminders" })}>Reminders ({reminderCount})</button>
        <button className="btn-success" onClick={() => setModal("walkin")}>+ Walk-in</button>

        <div className="ml-auto flex items-center gap-2">
          <input className="input !w-36 sm:!w-48" placeholder="Search name, mobile…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-outline !px-2.5" title="Send notification" onClick={() => setModal("notify")}>✉</button>
          <NotificationBell me={me} items={notifications} />
          {me.role === "admin" && <>
            <Link className="btn-outline" href="/reports">Reports</Link>
            <Link className="btn-outline" href="/admin">Admin</Link>
          </>}
          <button className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white py-0.5 pl-0.5 pr-2.5 text-xs font-bold" onClick={() => setModal("settings")}>
            {photoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
              : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[10px] text-white">{me.username[0]?.toUpperCase()}</span>}
            {me.full_name}
          </button>
          <form action={logout}><button className="btn-danger !px-2.5" title="Log out">⏻</button></form>
        </div>
      </div>

      <main className="px-3 py-3">
        <h1 className="mb-2 text-sm font-bold">{title} <span className="font-normal text-slate-500">· {visible.length}</span></h1>
        {visible.length === 0 && <p className="card p-6 text-center text-sm text-slate-500">No candidates in this list.</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map(({ c, cat, onboarding }) => (
            <button key={c.id} onClick={() => setOpenId(c.id)}
              className={`card border-l-4 p-3 text-left transition hover:shadow-md ${c.source === "walkin" ? "border-l-purple-500" : cat.active ? "border-l-sky-600" : cat.category.endsWith("joined_list") ? "border-l-green-600" : "border-l-red-500"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{c.name}</div>
                <Badge tone={cat.tone}>{cat.label}</Badge>
              </div>
              <div className="text-xs text-slate-600">{c.mobile} · {c.posts.join(", ") || "-"}</div>
              <div className="text-xs text-slate-500">{branchName(c.branch_id) ?? c.applied_locations.join(", ")}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                {c.next_action && <span className="text-slate-700">▸ {c.next_action}{c.next_action_at ? ` · ${formatDateTime(c.next_action_at)}` : ""}</span>}
                {onboarding && <Badge tone={onboarding.status === "completed" ? "green" : "amber"}>docs {onboarding.status}</Badge>}
                <span className="ml-auto text-slate-400">{formatDate(c.received_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-1 border-t border-slate-200 bg-white p-1.5 sm:hidden">
        <button className="btn-outline !text-xs" onClick={() => setFilter({ kind: "followup" })}>Follow-up</button>
        <button className="btn-outline !text-xs" onClick={() => setFilter({ kind: "completed" })}>Completed</button>
        <button className="btn-outline !text-xs" onClick={() => setFilter({ kind: "rejected" })}>Rejected</button>
        <button className="btn-outline !text-xs" onClick={() => setFilter({ kind: "today" })}>Today</button>
      </nav>

      {open && <CandidatePanel key={open.c.id} c={open.c} cat={open.cat} branches={branches} appUrl={appUrl} onClose={() => setOpenId(null)} />}
      {modal === "walkin" && <WalkinForm me={me} branches={branches} onClose={() => setModal(null)} />}
      {modal === "notify" && <SendNotification me={me} people={people} onClose={() => setModal(null)} />}
      {modal === "settings" && <Settings me={me} onClose={() => setModal(null)} />}
    </div>
  );
}

function Menu({ label, tone, items, onPick }: { label: string; tone: string; items: [string, string][]; onPick: (sub: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button className={`btn-outline ${tone}`} onClick={() => setOpen((o) => !o)}>{label} ▾</button>
      {open && (
        <div className="absolute left-0 z-40 mt-0.5 min-w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {items.map(([k, l]) => (
            <button key={k || "all"} className="block w-full rounded px-2.5 py-1.5 text-left text-sm hover:bg-slate-100" onClick={() => { onPick(k || undefined as never); setOpen(false); }}>{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Settings({ me, onClose }: { me: Profile; onClose: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title="Profile settings">
      <form action={(fd) => start(async () => setMsg(await updateMyProfile(fd)))} className="space-y-3">
        <p className="text-sm">Signed in as <b>{me.username}</b> ({me.role})</p>
        <Field label="Mobile"><input name="mobile" className="input" defaultValue={me.mobile ?? ""} /></Field>
        <Field label="New password (leave blank to keep, min 8 characters)"><input name="password" type="password" className="input" autoComplete="new-password" /></Field>
        <Field label="Profile photo"><input name="photo" type="file" accept="image/*" className="input" /></Field>
        <Flash msg={msg} />
        <button className="btn-primary" disabled={pending}>Save</button>
      </form>
    </Modal>
  );
}
