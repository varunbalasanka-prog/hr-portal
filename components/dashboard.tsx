"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isAdminRole, type Branch, type Candidate, type NotificationRow, type OnboardingSubmission, type Profile } from "@/lib/types";
import { ONBOARDING_CATEGORIES, countAll, isTodaysWork, needsTomorrowReminder, type Categorized } from "@/lib/categorize";
import { SMS_TITLES, joiningDate, offerValidity, smsItem, smsLink, smsText, type SmsItem } from "@/lib/sms";
import { waLink } from "@/lib/wa-templates";
import { markSmsSent, setEmployeeDetails } from "@/app/actions/candidates";
import { ago, formatDate, formatDateTime, friendlyWhen } from "@/lib/dates";
import { AppShell, Avatar, staffSections, type NavCounts } from "./app-shell";
import { CandidatePanel } from "./candidate-panel";
import { WalkinForm } from "./walkin-form";
import { NotificationBell, SendNotification } from "./notifications";
import { Icon, type IconName } from "./icons";
import { Badge, Field, Flash, Modal } from "./ui";

type Row = { c: Candidate; cat: Categorized; onboarding: OnboardingSubmission | null };

type Group = "followup" | "completed" | "rejected" | "onboarding" | "today" | "sms" | "reminders" | "approvals" | "reapply" | "talent";
/** A list is a group, optionally narrowed: "followup", "followup.received", "onboarding.docs_received"… */
type ListKey = string;

const GROUPS: Group[] = ["followup", "completed", "rejected", "onboarding", "today", "sms", "reminders", "approvals", "reapply", "talent"];

const TITLES: Record<Group, { title: string; hint: string }> = {
  today: { title: "Today's work", hint: "Calls and updates due today or overdue, plus tomorrow's interviews and joinings." },
  reminders: { title: "Tomorrow's reminders", hint: "Interviews and joinings happening tomorrow. Remind them today." },
  sms: { title: "SMS to send today", hint: "Nothing is sent automatically. Tap WhatsApp or SMS: your phone opens with the message ready, and the row is ticked off." },
  approvals: { title: "Waiting for approval", hint: "Salaries proposed by HR, and candidates HR put on hold after the interview." },
  followup: { title: "In follow-up", hint: "Everyone still being called, interviewed or waiting to join." },
  onboarding: { title: "Joined · onboarding", hint: "New joiners waiting for the store's employee code or HR's payroll step, and onboarding documents." },
  completed: { title: "Completed", hint: "Joined and payroll done." },
  rejected: { title: "Rejected / dropped", hint: "Closed candidates. Admins can reopen or move them to the Re-Apply folder." },
  talent: { title: "Talent pool", hint: "People worth calling for future openings. Search by tag, e.g. sales." },
  reapply: { title: "Re-Apply folder", hint: "People who applied again after being rejected or leaving. Decide if HR should call them." },
};

type Sub = { key: string; label: string; test: (r: Row) => boolean };
const leftWithout = (r: Row) => r.cat.category === "joined_left" && r.cat.label.includes("Without Information");
const docs = (suffix: string) => (r: Row) => r.cat.docCategory.endsWith(suffix);

/** Narrower lists inside a group, shown as chips above the cards. */
function subsFor(g: Group, store: boolean): Sub[] {
  const cat = (c: string) => (r: Row) => r.cat.category === c;
  switch (g) {
    case "followup": return [
      { key: "received", label: "New / not started", test: cat("received") },
      { key: "not_contacted", label: "Unreachable / retry", test: cat("not_contacted") },
      { key: "interview_scheduled", label: "Interview", test: cat("interview_scheduled") },
      { key: "selected_joined", label: "Expected joining", test: cat("selected_joined") },
    ];
    case "completed": return [
      { key: "online_joined_list", label: "Online", test: cat("online_joined_list") },
      { key: "walkin_joined_list", label: "Walk-in", test: cat("walkin_joined_list") },
    ];
    case "rejected": return [
      { key: "screening_rejected", label: "Screening rejected", test: cat("screening_rejected") },
      { key: "wrong_number", label: "Wrong number", test: cat("wrong_number") },
      { key: "not_contactable", label: "Not contactable", test: cat("not_contactable") },
      { key: "candidate_dropped", label: "Candidate dropped", test: cat("candidate_dropped") },
      { key: "left_with", label: "Left (resigned)", test: (r) => r.cat.category === "joined_left" && !leftWithout(r) },
      { key: "left_without", label: "Left (absconded)", test: leftWithout },
    ];
    case "onboarding": return [
      { key: "store_details_pending", label: "Waiting for store: code & shift", test: cat("store_details_pending") },
      { key: "payroll_pending", label: "Payroll pending", test: cat("payroll_pending") },
      ...(store ? [] : [
        { key: "docs_received", label: "Documents to verify", test: docs("docs_received") },
        { key: "docs_pending", label: "Sent back for correction", test: docs("docs_pending") },
        { key: "docs_not_submitted", label: "Documents not submitted", test: docs("docs_not_submitted") },
        { key: "docs_completed", label: "Documents completed", test: docs("docs_completed") },
      ]),
    ];
    default: return [];
  }
}

function inGroup(r: Row, g: Group, admin: boolean): boolean {
  const cat = r.cat.category;
  switch (g) {
    case "followup": return r.cat.active;
    case "completed": return cat === "online_joined_list" || cat === "walkin_joined_list";
    case "rejected": return !r.cat.active && !cat.endsWith("joined_list") && !ONBOARDING_CATEGORIES.includes(cat) && cat !== "reapply";
    case "onboarding": return ONBOARDING_CATEGORIES.includes(cat) || r.cat.docCategory !== "none";
    case "today": return isTodaysWork(r.c, r.cat);
    case "sms": return !!smsItem(r.c, r.cat);
    case "reminders": return needsTomorrowReminder(r.c, r.cat);
    case "approvals": return admin && (r.c.salary_status === "proposed" || r.c.pipeline_status === "Waiting for Admin Approval");
    case "reapply": return cat === "reapply";
    case "talent": return r.c.talent_pool;
  }
}

/** Old links (?list=salary, ?list=docs.joined_docs_received) still land somewhere sensible. */
function parseKey(key: string | undefined): { group: Group; sub?: string } {
  const [g, sub] = (key ?? "").split(".");
  if (g === "salary") return { group: "approvals" };
  if (g === "docs") return { group: "onboarding", sub: sub?.replace(/^(not_)?joined_/, "") };
  return GROUPS.includes(g as Group) ? { group: g as Group, sub } : { group: "followup" };
}

export function Dashboard({ me, photoUrl, rows, branches, people, notifications, appUrl, initialList }: {
  me: Profile; photoUrl: string | null; rows: Row[]; branches: Branch[]; people: Profile[]; notifications: NotificationRow[]; appUrl: string; initialList?: string;
}) {
  const admin = isAdminRole(me.role);
  const store = me.role === "branch";
  const [list, setList] = useState<{ group: Group; sub?: string }>(() => parseKey(initialList));
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [modal, setModal] = useState<"walkin" | "notify" | null>(null);

  // Keep the address bar in step, so Back, refresh and shared links open the same list.
  useEffect(() => {
    const key = list.sub ? `${list.group}.${list.sub}` : list.group;
    const url = new URL(window.location.href);
    if (url.searchParams.get("list") !== key) { url.searchParams.set("list", key); window.history.replaceState(null, "", url); }
  }, [list]);

  const counts = useMemo(() => countAll(rows.map((r) => r.cat)), [rows]);
  const groupCount = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g, rows.filter((r) => inGroup(r, g, admin)).length])) as Record<Group, number>, [rows, admin]);
  const navCounts: NavCounts = { ...groupCount };
  const subs = subsFor(list.group, store);
  const needStoreDetails = useMemo(() => store ? rows.filter((r) => r.cat.category === "store_details_pending").map((r) => r.c) : [], [rows, store]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle) {
      return rows.filter((r) => (list.group !== "talent" || r.c.talent_pool)
        && [r.c.name, r.c.mobile, r.c.posts.join(" "), r.c.applied_locations.join(" "), r.cat.label, r.c.talent_tags.join(" ")].join(" ").toLowerCase().includes(needle));
    }
    const sub = subs.find((s) => s.key === list.sub);
    return rows.filter((r) => inGroup(r, list.group, admin) && (!sub || sub.test(r)));
  }, [rows, list, q, subs, admin]);

  const open = rows.find((r) => r.c.id === openId);
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name;
  const pick = (key: string) => { setList(parseKey(key)); setQ(""); window.scrollTo({ top: 0 }); };
  const head = TITLES[list.group];

  const tiles: { key: Group; label: string; icon: IconName; n: number; tone: string }[] = [
    { key: "today", label: "Today's work", icon: "today", n: groupCount.today, tone: "text-brand bg-sky-50" },
    { key: "reminders", label: "Remind for tomorrow", icon: "alarm", n: groupCount.reminders, tone: "text-amber-700 bg-amber-50" },
    store
      ? { key: "onboarding", label: "Need code & shift", icon: "clipboard", n: counts.store_details_pending, tone: "text-red-700 bg-red-50" }
      : { key: "sms", label: "SMS to send", icon: "message", n: groupCount.sms, tone: "text-emerald-700 bg-emerald-50" },
    admin
      ? { key: "approvals", label: "Waiting for approval", icon: "badge", n: groupCount.approvals, tone: "text-red-700 bg-red-50" }
      : { key: "followup", label: "In follow-up", icon: "users", n: groupCount.followup, tone: "text-slate-700 bg-slate-100" },
  ];

  const bell = <NotificationBell me={me} items={notifications} />;
  const search = (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">Search candidates</span>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className="input !pl-9" type="search" placeholder="Search name, mobile, post…" value={q} onChange={(e) => setQ(e.target.value)} />
    </label>
  );

  return (
    <AppShell me={me} photoUrl={photoUrl} sections={staffSections(me.role, navCounts)} active={q ? "" : list.group} onPick={pick}
      actions={<>{bell}<button className="btn-primary !px-2.5" onClick={() => setModal("walkin")} aria-label="Add walk-in"><Icon name="plus" /></button></>}>
      <main className="pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">
              {q ? <>Search: “{q}”</> : head.title} <span className="ml-1 align-middle text-sm font-semibold text-slate-400 tabular-nums">{visible.length}</span>
            </h1>
            {!q && <p className="mt-0.5 max-w-2xl text-sm text-slate-500">{head.hint}</p>}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {search}
            <div className="hidden items-center gap-2 lg:flex">
              <button className="btn-outline" onClick={() => setModal("notify")}><Icon name="send" /> Message</button>
              {bell}
              <button className="btn-primary" onClick={() => setModal("walkin")}><Icon name="plus" /> Walk-in</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 px-4 pt-4 sm:px-6 xl:grid-cols-4">
          {tiles.map((t) => (
            <button key={t.label} onClick={() => pick(t.key)}
              className={`card flex items-center gap-3 p-3 text-left transition hover:border-sky-200 hover:shadow-md ${list.group === t.key && !q ? "!border-sky-300 ring-2 ring-sky-100" : ""}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.tone}`}><Icon name={t.icon} className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-2xl font-bold leading-none tabular-nums">{t.n}</span>
                <span className="mt-1 block truncate text-xs font-medium text-slate-500">{t.label}</span>
              </span>
            </button>
          ))}
        </div>

        {!q && subs.length > 0 && (
          <div className="scroll-thin flex gap-2 overflow-x-auto px-4 pt-4 sm:flex-wrap sm:px-6" role="tablist" aria-label="Narrow the list">
            <button role="tab" aria-selected={!list.sub} className={`chip ${!list.sub ? "chip-on" : ""}`} onClick={() => setList({ group: list.group })}>
              All <span className="tabular-nums opacity-70">{groupCount[list.group]}</span>
            </button>
            {subs.map((s) => {
              const n = rows.filter((r) => s.test(r)).length;
              return (
                <button key={s.key} role="tab" aria-selected={list.sub === s.key} className={`chip ${list.sub === s.key ? "chip-on" : ""}`} onClick={() => setList({ group: list.group, sub: s.key })}>
                  {s.label} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="px-4 pt-4 sm:px-6">
          {visible.length === 0 && (
            <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name={q ? "search" : "inbox"} className="h-6 w-6" /></span>
              <p className="font-semibold text-slate-700">{q ? "No one matches that search" : "Nothing here right now"}</p>
              <p className="text-sm text-slate-500">{q ? "Try part of the name or the last 4 digits of the mobile." : list.group === "today" ? "You're all caught up for today." : "Candidates appear here as their status changes."}</p>
            </div>
          )}
          {list.group === "sms" && !q ? (
            <div className="space-y-3">
              {visible.map(({ c, cat }) => {
                const item = smsItem(c, cat);
                return item ? <SmsRow key={c.id} c={c} item={item} branches={branches} people={people} onOpen={() => setOpenId(c.id)} /> : null;
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map(({ c, cat, onboarding }) => (
                <CandidateCard key={c.id} c={c} cat={cat} onboarding={onboarding} branch={branchName(c.branch_id) ?? c.applied_locations.join(", ")} onOpen={() => setOpenId(c.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {needStoreDetails.length > 0 && <StoreJoiningPopup people={needStoreDetails} />}
      {open && <CandidatePanel key={open.c.id} me={me} c={open.c} cat={open.cat} branches={branches} appUrl={appUrl} onClose={() => setOpenId(null)} />}
      {modal === "walkin" && <WalkinForm me={me} branches={branches} onClose={() => setModal(null)} />}
      {modal === "notify" && <SendNotification me={me} people={people} onClose={() => setModal(null)} />}
    </AppShell>
  );
}

const formatMobile = (m: string) => (/^\d{10}$/.test(m) ? `${m.slice(0, 5)} ${m.slice(5)}` : m);

function CandidateCard({ c, cat, onboarding, branch, onOpen }: { c: Candidate; cat: Categorized; onboarding: OnboardingSubmission | null; branch: string; onOpen: () => void }) {
  const when = c.next_action_at ? friendlyWhen(c.next_action_at, { dateOnly: /join/i.test(c.next_action ?? "") }) : null;
  const accent = cat.active ? "before:bg-sky-500" : cat.category.endsWith("joined_list") ? "before:bg-emerald-500" : ONBOARDING_CATEGORIES.includes(cat.category) ? "before:bg-amber-500" : "before:bg-slate-300";
  return (
    <button onClick={onOpen}
      className={`card group relative flex flex-col gap-3 overflow-hidden p-4 text-left transition before:absolute before:inset-y-0 before:left-0 before:w-1 hover:border-sky-200 hover:shadow-md ${accent}`}>
      <div className="flex items-start gap-3">
        <Avatar name={c.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold text-slate-900 group-hover:text-brand">{c.name}</span>
            <span className="shrink-0 text-xs text-slate-400" title={`Received ${formatDateTime(c.received_at)}`}>{ago(c.received_at)}</span>
          </div>
          <div className="truncate text-sm text-slate-600">{c.designation || c.posts.join(", ") || "-"} · <span className="tabular-nums">{formatMobile(c.mobile)}</span></div>
          <div className="truncate text-xs text-slate-500">{branch || "No branch yet"}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={cat.tone} dot>{cat.label}</Badge>
        {c.source === "walkin" && <Badge tone="purple">Walk-in</Badge>}
        {onboarding && <Badge tone={onboarding.status === "completed" ? "green" : "amber"}>Docs {onboarding.status === "submitted" ? "to verify" : onboarding.status}</Badge>}
        {c.talent_pool && <Badge tone="indigo">Talent pool</Badge>}
      </div>
      {c.next_action && cat.active && (
        <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${when?.overdue ? "bg-red-50 text-red-700" : when?.soon ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600"}`}>
          <Icon name="clock" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{c.next_action}{when ? ` · ${when.text}` : ""}</span>
        </div>
      )}
    </button>
  );
}

/** One row of Today's SMS List: the message for today, with WhatsApp and normal SMS buttons. */
function SmsRow({ c, item, branches, people, onOpen }: { c: Candidate; item: SmsItem; branches: Branch[]; people: Profile[]; onOpen: () => void }) {
  const router = useRouter();
  const [, start] = useTransition();
  const branch = branches.find((b) => b.id === c.branch_id) ?? branches.find((b) => b.name === c.applied_locations[0]);
  const hr = people.find((p) => p.username === c.assigned_hr);
  const joining = joiningDate(c);
  const isJoining = item.kind === "joining_reminder" || item.kind === "not_joined";
  const text = smsText(item.kind, {
    name: c.name, post: c.designation ?? c.posts[0] ?? "", store: branch?.name ?? "Balasanka Group", address: branch?.address ?? branch?.town ?? "",
    when: isJoining ? formatDate(joining) : formatDateTime(c.interview_at), hrName: hr?.full_name || c.assigned_hr, hrMobile: hr?.mobile || null,
    validity: joining ? offerValidity(joining) : undefined,
  });
  const needsHr = item.kind === "not_contactable" || item.kind === "interview_missed" || item.kind === "not_joined";
  const sent = (channel: "whatsapp" | "sms") => start(async () => { await markSmsSent(c.id, item.key, SMS_TITLES[item.kind], channel); router.refresh(); });
  return (
    <div className="card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button className="font-semibold text-slate-900 hover:text-brand hover:underline" onClick={onOpen}>{c.name}</button>
        <span className="text-xs text-slate-500 tabular-nums">{formatMobile(c.mobile)} · HR {c.assigned_hr}</span>
        <Badge tone="sky">{SMS_TITLES[item.kind]}</Badge>
      </div>
      {needsHr && !hr?.mobile && <p className="mt-1 text-xs text-amber-700">{c.assigned_hr} has no mobile in Profile settings, so the message says &quot;call us back on this number&quot;.</p>}
      <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{text}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a className="btn-success" href={waLink(c.mobile, text)} target="_blank" rel="noreferrer" onClick={() => sent("whatsapp")}><Icon name="message" /> WhatsApp</a>
        <a className="btn-outline" href={smsLink(c.mobile, text)} onClick={() => sent("sms")}><Icon name="send" /> Normal SMS</a>
      </div>
    </div>
  );
}

/** Store logins: a joined employee needs an employee (biometric) code and shift timing before anything else. */
function StoreJoiningPopup({ people }: { people: Candidate[] }) {
  const router = useRouter();
  const c = people[0];
  const [code, setCode] = useState("");
  const [shift, setShift] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal open locked onClose={() => {}} title="New joining: employee code & shift" subtitle={people.length > 1 ? `1 of ${people.length} new joiners` : undefined}>
      <div className="space-y-3 text-sm">
        <p><b>{c.name}</b> ({c.mobile}) joined on <b>{formatDate(c.actual_joining_date)}</b>{c.designation ? ` as ${c.designation}` : ""}. Enter their employee code and shift timing to continue.</p>
        <Field label="Employee code (biometric code) *"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></Field>
        <Field label="Shift timing *"><input className="input" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="e.g. 9:30 AM - 8:30 PM" /></Field>
        <Flash msg={msg} />
        <button className="btn-primary w-full" disabled={pending || !code.trim() || !shift.trim()} onClick={() => start(async () => {
          const r = await setEmployeeDetails(c.id, code, shift);
          setMsg(r);
          if (r.ok) { setCode(""); setShift(""); setMsg(null); router.refresh(); }
        })}>{pending ? "Saving…" : "Save and send to HR"}</button>
      </div>
    </Modal>
  );
}
