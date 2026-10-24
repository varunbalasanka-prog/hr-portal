"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAdminRole, type Branch, type Candidate, type NotificationRow, type OnboardingSubmission, type Profile } from "@/lib/types";
import { ONBOARDING_CATEGORIES, countAll, isTodaysWork, needsTomorrowReminder, type Categorized } from "@/lib/categorize";
import { SMS_TITLES, joiningDate, offerValidity, smsItem, smsLink, smsText, type SmsItem } from "@/lib/sms";
import { waLink } from "@/lib/wa-templates";
import { markSmsSent, setEmployeeDetails } from "@/app/actions/candidates";
import { formatDate, formatDateTime } from "@/lib/dates";
import { logout } from "@/app/login/actions";
import { updateMyProfile } from "@/app/actions/users";
import { TwoStepLogin } from "./two-step";
import { PushToggle } from "./push-toggle";
import { CandidatePanel } from "./candidate-panel";
import { WalkinForm } from "./walkin-form";
import { NotificationBell, SendNotification } from "./notifications";
import { Badge, Field, Flash, Modal, tooBig } from "./ui";

type Row = { c: Candidate; cat: Categorized; onboarding: OnboardingSubmission | null };

type Filter =
  | { kind: "followup"; sub?: "received" | "interview_scheduled" | "selected_joined" | "not_contacted" }
  | { kind: "completed"; sub?: "online_joined_list" | "walkin_joined_list" }
  | { kind: "rejected"; sub?: "screening_rejected" | "wrong_number" | "not_contactable" | "candidate_dropped" | "joined_left" | "left_with" | "left_without" }
  | { kind: "docs"; sub: string }
  | { kind: "onboarding"; sub?: "store_details_pending" | "payroll_pending" }
  | { kind: "today" }
  | { kind: "sms" }
  | { kind: "reminders" }
  | { kind: "reapply" }
  | { kind: "talent" };

const FILTER_TITLES: Record<string, string> = {
  followup: "In follow-up", completed: "Completed", rejected: "Rejected / dropped", today: "Today's work", reminders: "Tomorrow's reminders", talent: "Talent pool (search by tag, e.g. sales)",
  sms: "Today's SMS list", reapply: "Re-Apply folder (admin only)", onboarding: "Joined: store details & payroll",
  store_details_pending: "Waiting for store: employee code & shift", payroll_pending: "Payroll completion pending",
  left_with: "Left with information (resigned, re-apply allowed)", left_without: "Left without information (absconding)",
  received: "New / not started", interview_scheduled: "Interview scheduled", selected_joined: "Expected joining", not_contacted: "Unreachable / retry",
  online_joined_list: "Online joined", walkin_joined_list: "Walk-in joined",
  screening_rejected: "Screening rejected", wrong_number: "Wrong number", not_contactable: "Not contactable", candidate_dropped: "Candidate dropped", joined_left: "Joined & left",
  joined_docs_received: "Docs submitted · joined", not_joined_docs_received: "Docs submitted · expected joining",
  joined_docs_pending: "Docs pending · joined", not_joined_docs_pending: "Docs pending · expected joining",
  joined_docs_not_submitted: "Docs not submitted · joined", not_joined_docs_not_submitted: "Docs not submitted · expected joining",
};

function matches(r: Row, f: Filter): boolean {
  const cat = r.cat.category;
  switch (f.kind) {
    case "followup": return r.cat.active && (!f.sub || cat === f.sub);
    case "completed": return cat === "online_joined_list" || cat === "walkin_joined_list" ? (!f.sub || cat === f.sub) : false;
    case "rejected":
      if (r.cat.active || cat.endsWith("joined_list") || ONBOARDING_CATEGORIES.includes(cat) || cat === "reapply") return false;
      if (f.sub === "left_with" || f.sub === "left_without") return cat === "joined_left" && r.cat.label.includes("Without Information") === (f.sub === "left_without");
      return !f.sub || cat === f.sub;
    case "docs": return r.cat.docCategory === f.sub;
    case "onboarding": return ONBOARDING_CATEGORIES.includes(cat) && (!f.sub || cat === f.sub);
    case "today": return isTodaysWork(r.c, r.cat);
    case "sms": return !!smsItem(r.c, r.cat);
    case "reminders": return needsTomorrowReminder(r.c, r.cat);
    case "reapply": return cat === "reapply";
    case "talent": return r.c.talent_pool;
  }
}

type MenuItem = [Filter, string];
type MenuGroup = { label: string; tone: string; items: MenuItem[] };

export function Dashboard({ me, photoUrl, rows, branches, people, notifications, appUrl }: {
  me: Profile; photoUrl: string | null; rows: Row[]; branches: Branch[]; people: Profile[]; notifications: NotificationRow[]; appUrl: string;
}) {
  const [filter, setFilter] = useState<Filter>({ kind: "followup" });
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [modal, setModal] = useState<"walkin" | "notify" | "settings" | null>(null);
  const [drawer, setDrawer] = useState(false);
  const admin = isAdminRole(me.role);
  const store = me.role === "branch";
  const counts = useMemo(() => countAll(rows.map((r) => r.cat)), [rows]);
  const todayCount = useMemo(() => rows.filter((r) => isTodaysWork(r.c, r.cat)).length, [rows]);
  const smsCount = useMemo(() => rows.filter((r) => smsItem(r.c, r.cat)).length, [rows]);
  const reminderCount = useMemo(() => rows.filter((r) => needsTomorrowReminder(r.c, r.cat)).length, [rows]);
  // Joined at this store, but the store hasn't entered employee code + shift yet: a popup the store must finish.
  const needStoreDetails = useMemo(() => store ? rows.filter((r) => r.cat.category === "store_details_pending").map((r) => r.c) : [], [rows, store]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle) {
      return rows.filter((r) => (filter.kind !== "talent" || r.c.talent_pool)
        && [r.c.name, r.c.mobile, r.c.posts.join(" "), r.c.applied_locations.join(" "), r.cat.label, r.c.talent_tags.join(" ")].join(" ").toLowerCase().includes(needle));
    }
    return rows.filter((r) => matches(r, filter));
  }, [rows, filter, q]);

  const open = rows.find((r) => r.c.id === openId);
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name;
  const talentCount = useMemo(() => rows.filter((r) => r.c.talent_pool).length, [rows]);
  const title = q ? `Search${filter.kind === "talent" ? " in talent pool" : ""}: “${q}”` : FILTER_TITLES[("sub" in filter && filter.sub) || filter.kind];
  const pick = (f: Filter) => { setFilter(f); setQ(""); setDrawer(false); };

  const groups: MenuGroup[] = [
    { label: `In follow-up (${counts.in_followup})`, tone: "text-sky-700", items: [
      [{ kind: "followup" }, `All (${counts.in_followup})`], [{ kind: "followup", sub: "received" }, `New / not started (${counts.received})`],
      [{ kind: "followup", sub: "interview_scheduled" }, `Interview scheduled (${counts.interview_scheduled})`],
      [{ kind: "followup", sub: "selected_joined" }, `Expected joining (${counts.selected_joined})`], [{ kind: "followup", sub: "not_contacted" }, `Unreachable / retry (${counts.not_contacted})`],
    ] },
    { label: `Completed (${counts.completed})`, tone: "text-green-700", items: [
      [{ kind: "completed" }, `All (${counts.completed})`], [{ kind: "completed", sub: "online_joined_list" }, `Online joined (${counts.online_joined_list})`],
      [{ kind: "completed", sub: "walkin_joined_list" }, `Walk-in joined (${counts.walkin_joined_list})`],
    ] },
    { label: `Rejected (${counts.rejected})`, tone: "text-red-700", items: [
      [{ kind: "rejected" }, `All (${counts.rejected})`], [{ kind: "rejected", sub: "screening_rejected" }, `Screening rejected (${counts.screening_rejected})`],
      [{ kind: "rejected", sub: "wrong_number" }, `Wrong number (${counts.wrong_number})`], [{ kind: "rejected", sub: "not_contactable" }, `Not contactable (${counts.not_contactable})`],
      [{ kind: "rejected", sub: "candidate_dropped" }, `Candidate dropped (${counts.candidate_dropped})`],
      [{ kind: "rejected", sub: "left_with" }, `Left with information (${counts.left_with})`], [{ kind: "rejected", sub: "left_without" }, `Left without information (${counts.left_without})`],
    ] },
    { label: `Onboarding (${counts.onboarding})`, tone: "text-teal-700", items: [
      [{ kind: "onboarding", sub: "store_details_pending" }, `Waiting for store: code & shift (${counts.store_details_pending})`],
      [{ kind: "onboarding", sub: "payroll_pending" }, `Payroll completion pending (${counts.payroll_pending})`],
      ...(store ? [] : ([
        [{ kind: "docs", sub: "joined_docs_received" }, "Docs submitted · joined"], [{ kind: "docs", sub: "not_joined_docs_received" }, "Docs submitted · expected joining"],
        [{ kind: "docs", sub: "joined_docs_pending" }, "Docs pending · joined"], [{ kind: "docs", sub: "not_joined_docs_pending" }, "Docs pending · expected joining"],
        [{ kind: "docs", sub: "joined_docs_not_submitted" }, "Docs not submitted · joined"], [{ kind: "docs", sub: "not_joined_docs_not_submitted" }, "Docs not submitted · expected joining"],
      ] as MenuItem[])),
    ] },
  ];
  const quick: MenuItem[] = [
    [{ kind: "today" }, `Today (${todayCount})`],
    ...(store ? [] : [[{ kind: "sms" }, `Today's SMS (${smsCount})`] as MenuItem]),
    [{ kind: "reminders" }, `Reminders (${reminderCount})`],
    [{ kind: "talent" }, `Talent pool (${talentCount})`],
    ...(admin ? [[{ kind: "reapply" }, `Re-Apply folder (${counts.reapply})`] as MenuItem] : []),
  ];
  const profileButton = (
    <button className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white py-0.5 pl-0.5 pr-2.5 text-xs font-bold" onClick={() => { setModal("settings"); setDrawer(false); }}>
      {photoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-xs text-white">{me.username[0]?.toUpperCase()}</span>}
      {me.full_name}
    </button>
  );

  return (
    <div className="overflow-x-hidden pb-6">
      <header className="flex items-center justify-between border-b-2 border-brand-accent bg-white px-4 py-2">
        <div>
          <div className="font-serif text-base font-extrabold uppercase tracking-wide sm:text-lg">Balasanka Group of Companies</div>
          <div className="hidden text-xs font-semibold text-slate-500 sm:block">Theni • Madurai • Virudhunagar • Sivakasi • Srivilliputhur • Rajapalayam • Tenkasi • Tirunelveli</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/balasanka_logo.png" alt="" className="h-9 w-auto" />
      </header>

      {/* Phones: one menu button holds every list and page, so nothing scrolls sideways. */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur md:hidden">
        <button className="btn-outline !px-2.5" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>☰ Menu</button>
        <input className="input min-w-0 flex-1" placeholder="Search name, mobile…" value={q} onChange={(e) => setQ(e.target.value)} />
        <NotificationBell me={me} items={notifications} />
      </div>
      {drawer && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onMouseDown={() => setDrawer(false)}>
          <nav className="h-full w-72 max-w-[85vw] overflow-y-auto bg-white p-3 shadow-xl" aria-label="Menu" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              {profileButton}
              <button className="text-2xl leading-none text-slate-500" aria-label="Close menu" onClick={() => setDrawer(false)}>×</button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {quick.map(([f, l]) => <button key={l} className="btn-outline !justify-start !text-xs" onClick={() => pick(f)}>{l}</button>)}
              <button className="btn-success col-span-2" onClick={() => { setModal("walkin"); setDrawer(false); }}>+ Walk-in</button>
            </div>
            {groups.map((g) => (
              <div key={g.label} className="mt-3">
                <div className={`mb-1 text-xs font-bold uppercase ${g.tone}`}>{g.label}</div>
                {g.items.map(([f, l]) => <button key={l} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100" onClick={() => pick(f)}>{l}</button>)}
              </div>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-slate-200 pt-3">
              <button className="btn-outline" onClick={() => { setModal("notify"); setDrawer(false); }}>✉ Message</button>
              <Link className="btn-outline" href="/manpower">Manpower</Link>
              {admin && <><Link className="btn-outline" href="/reports">Reports</Link><Link className="btn-outline" href="/admin">Admin</Link></>}
              <form action={logout} className="col-span-2"><button className="btn-danger w-full">Log out</button></form>
            </div>
          </nav>
        </div>
      )}

      <div className="sticky top-0 z-30 hidden flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur md:flex">
        {groups.map((g) => <Menu key={g.label} label={g.label} tone={g.tone} items={g.items} onPick={pick} />)}
        {quick.map(([f, l]) => <button key={l} className={`btn-outline ${f.kind === "talent" ? "text-purple-700" : f.kind === "reapply" ? "text-fuchsia-700" : ""}`} onClick={() => pick(f)}>{l}</button>)}
        <button className="btn-success" onClick={() => setModal("walkin")}>+ Walk-in</button>

        <div className="ml-auto flex items-center gap-2">
          <input className="input !w-48" placeholder="Search name, mobile…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-outline !px-2.5" title="Send notification" onClick={() => setModal("notify")}>✉</button>
          <NotificationBell me={me} items={notifications} />
          <Link className="btn-outline" href="/manpower">Manpower</Link>
          {admin && <>
            <Link className="btn-outline" href="/reports">Reports</Link>
            <Link className="btn-outline" href="/admin">Admin</Link>
          </>}
          {profileButton}
          <form action={logout}><button className="btn-danger !px-2.5" title="Log out">⏻</button></form>
        </div>
      </div>

      <main className="px-3 py-3">
        <h1 className="mb-2 text-sm font-bold">{title} <span className="font-normal text-slate-500">· {visible.length}</span></h1>
        {visible.length === 0 && <p className="card p-6 text-center text-sm text-slate-500">No candidates in this list.</p>}
        {filter.kind === "sms" && !q ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-600">Nothing is sent automatically. Tap WhatsApp or SMS: your phone opens with the message ready, and the row is ticked off.</p>
            {visible.map(({ c, cat }) => {
              const item = smsItem(c, cat);
              return item ? <SmsRow key={c.id} c={c} item={item} branches={branches} people={people} onOpen={() => setOpenId(c.id)} /> : null;
            })}
          </div>
        ) : <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map(({ c, cat, onboarding }) => (
            <button key={c.id} onClick={() => setOpenId(c.id)}
              className={`card border-l-4 p-3 text-left transition hover:shadow-md ${c.source === "walkin" ? "border-l-purple-500" : cat.active ? "border-l-sky-600" : cat.category.endsWith("joined_list") ? "border-l-green-600" : "border-l-red-500"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 break-words font-semibold">{c.name}</div>
                <Badge tone={cat.tone}>{cat.label}</Badge>
              </div>
              <div className="text-xs text-slate-600">{c.mobile} · {c.posts.join(", ") || "-"}</div>
              <div className="text-xs text-slate-500">{branchName(c.branch_id) ?? c.applied_locations.join(", ")}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                {c.next_action && <span className="text-slate-700">▸ {c.next_action}{c.next_action_at ? ` · ${formatDateTime(c.next_action_at)}` : ""}</span>}
                {onboarding && <Badge tone={onboarding.status === "completed" ? "green" : "amber"}>docs {onboarding.status}</Badge>}
                <span className="ml-auto text-slate-400">{formatDate(c.received_at)}</span>
              </div>
            </button>
          ))}
        </div>}
      </main>

      {needStoreDetails.length > 0 && <StoreJoiningPopup people={needStoreDetails} />}

      {open && <CandidatePanel key={open.c.id} me={me} c={open.c} cat={open.cat} branches={branches} appUrl={appUrl} onClose={() => setOpenId(null)} />}
      {modal === "walkin" && <WalkinForm me={me} branches={branches} onClose={() => setModal(null)} />}
      {modal === "notify" && <SendNotification me={me} people={people} onClose={() => setModal(null)} />}
      {modal === "settings" && <Settings me={me} onClose={() => setModal(null)} />}
    </div>
  );
}

function Menu({ label, tone, items, onPick }: { label: string; tone: string; items: MenuItem[]; onPick: (f: Filter) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button className={`btn-outline ${tone}`} onClick={() => setOpen((o) => !o)}>{label} ▾</button>
      {open && (
        <div className="absolute left-0 z-40 mt-0.5 min-w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {items.map(([f, l]) => (
            <button key={l} className="block w-full rounded px-2.5 py-1.5 text-left text-sm hover:bg-slate-100" onClick={() => { onPick(f); setOpen(false); }}>{l}</button>
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
        <Field label="Current password (needed only to change the password)"><input name="current_password" type="password" className="input" autoComplete="current-password" /></Field>
        <Field label="Profile photo"><input name="photo" type="file" accept="image/*" className="input" onChange={tooBig} /></Field>
        <Flash msg={msg} />
        <button className="btn-primary" disabled={pending}>Save</button>
      </form>
      <PushToggle />
      <TwoStepLogin admin={isAdminRole(me.role)} />
    </Modal>
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
    <div className="card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button className="font-semibold text-sky-800 underline" onClick={onOpen}>{c.name}</button>
        <span className="text-xs text-slate-600">{c.mobile} · HR {c.assigned_hr}</span>
        <Badge tone="indigo">{SMS_TITLES[item.kind]}</Badge>
      </div>
      {needsHr && !hr?.mobile && <p className="mt-1 text-xs text-amber-700">{c.assigned_hr} has no mobile in Profile settings, so the message says &quot;call us back on this number&quot;.</p>}
      <p className="mt-1.5 whitespace-pre-line break-words rounded bg-slate-50 p-2 text-xs text-slate-700">{text}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a className="btn-success" href={waLink(c.mobile, text)} target="_blank" rel="noreferrer" onClick={() => sent("whatsapp")}>WhatsApp</a>
        <a className="btn-primary" href={smsLink(c.mobile, text)} onClick={() => sent("sms")}>Normal SMS</a>
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
    <Modal open locked onClose={() => {}} title={`New joining: employee code & shift${people.length > 1 ? ` (1 of ${people.length})` : ""}`}>
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
