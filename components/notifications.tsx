"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isAdminRole, type NotificationRow, type Profile } from "@/lib/types";
import { formatDateTime } from "@/lib/dates";
import { clearAllNotifications, clearNotification, markNotificationViewed, notificationFileUrl, sendNotification } from "@/app/actions/notifications";
import { Field, Flash, Modal, Select, tooBig } from "./ui";
import { Icon } from "./icons";

/** Where tapping a notification goes. Only pages inside the portal; anything else is ignored. */
function safeLink(link: string | null | undefined) {
  return link && /^\/[a-z]/.test(link) ? link : null;
}

export function NotificationBell({ me, items, onOpenCandidate, onPickList }: {
  me: Profile; items: NotificationRow[];
  /** On the dashboard: open a candidate's panel / switch list in place instead of reloading the page. */
  onOpenCandidate?: (id: string) => void; onPickList?: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<number>>(new Set()); // cleared here, before the server list refreshes
  const [, start] = useTransition();
  const router = useRouter();
  const shown = items.filter((n) => !hidden.has(n.id));
  const unread = shown.filter((n) => !n.viewed_at && n.recipient === me.username).length;
  const hide = (ids: number[]) => setHidden((h) => new Set([...h, ...ids]));

  const go = (n: NotificationRow) => {
    const link = safeLink(n.link);
    if (!n.viewed_at && n.recipient === me.username) start(async () => { await markNotificationViewed(n.id); router.refresh(); });
    if (!link) return;
    setOpen(false);
    const url = new URL(link, window.location.origin);
    const candidate = url.searchParams.get("open"), list = url.searchParams.get("list");
    if (url.pathname === "/dashboard" && candidate && onOpenCandidate) return onOpenCandidate(candidate);
    if (url.pathname === "/dashboard" && list && !candidate && onPickList) return onPickList(list);
    router.push(link);
  };
  const clearOne = (id: number) => { hide([id]); start(async () => { await clearNotification(id); router.refresh(); }); };
  const clearAll = () => {
    const ids = shown.map((n) => n.id);
    if (!ids.length || !confirm(`Clear all ${ids.length} notification${ids.length > 1 ? "s" : ""}? They are hidden only from your list.`)) return;
    hide(ids);
    start(async () => { await clearAllNotifications(ids); router.refresh(); });
  };

  return (
    <div className="relative">
      <button className="btn-outline relative !px-2.5" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} aria-expanded={open}>
        <Icon name="bell" />{unread > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-brand-accent px-1 text-center text-[11px] font-bold leading-5 text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 max-h-[28rem] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-pop">
          <div className="sticky -top-2 -mx-2 -mt-2 mb-1 flex items-center justify-between gap-2 rounded-t-xl border-b bg-white px-2 py-2">
            <span className="text-xs font-bold">Notifications{isAdminRole(me.role) && " (all, admin view)"}</span>
            {shown.length > 0 && <button className="text-xs font-semibold text-sky-700 hover:underline" onClick={clearAll}>Clear all</button>}
          </div>
          {shown.length === 0 && <p className="py-3 text-center text-xs text-slate-500">No notifications.</p>}
          {shown.map((n) => {
            const link = safeLink(n.link);
            return (
              <div key={n.id} className="flex gap-1 border-b text-xs last:border-0">
                <button type="button" onClick={() => go(n)} title={link ? "Open" : undefined}
                  className={`min-w-0 flex-1 rounded-lg p-1.5 text-left ${link ? "cursor-pointer hover:bg-slate-50" : "cursor-default"}`}>
                  <span className={`font-semibold ${n.viewed_at ? "text-slate-500" : "text-sky-700"}`}>{n.sender}{isAdminRole(me.role) && ` → ${n.recipient}`}</span>
                  <span className="my-1 block whitespace-pre-line text-slate-800">{n.message}</span>
                  <span className="flex items-center justify-between text-slate-500">
                    <span>{formatDateTime(n.created_at)}</span>
                    {link && <span className="font-semibold text-sky-700">Open ›</span>}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-end justify-between py-1.5">
                  <button className="rounded px-1 text-slate-400 hover:text-red-600" title="Clear" aria-label="Clear this notification" onClick={() => clearOne(n.id)}>✕</button>
                  {n.file_path && <button className="text-sky-700 underline" onClick={async () => { const u = await notificationFileUrl(n.file_path!); if (u) window.open(u, "_blank"); }}>file</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SendNotification({ me, people, onClose }: { me: Profile; people: Profile[]; onClose: () => void }) {
  const [recipient, setRecipient] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const options = people.filter((p) => p.username !== me.username).map((p) => ({ value: p.username, label: `${p.full_name} (${p.role})` }));
  return (
    <Modal open onClose={onClose} title="Send notification">
      <form action={(fd) => start(async () => { const r = await sendNotification(fd); setMsg(r); if (r.ok) { router.refresh(); setTimeout(onClose, 700); } })} className="space-y-3">
        <Field label="To *"><Select name="recipient" value={recipient} onChange={setRecipient} options={options} /></Field>
        <Field label="Message *"><textarea name="message" className="input" rows={3} required /></Field>
        <Field label="Attach file (optional, max 4 MB)"><input name="file" type="file" className="input" onChange={tooBig} /></Field>
        <Flash msg={msg} />
        <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
      </form>
    </Modal>
  );
}
