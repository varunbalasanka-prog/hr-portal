import { isAdminRole, type Role } from "./types";
import type { IconName } from "@/components/icons";

export type NavItem = { key: string; label: string; icon: IconName; count?: number; alert?: boolean; href?: string; external?: boolean };
export type NavSection = { title: string; items: NavItem[] };
export type NavCounts = Partial<Record<"today" | "reminders" | "sms" | "approvals" | "followup" | "onboarding" | "completed" | "rejected" | "talent" | "reapply", number>>;

/** The same menu on every staff page. Dashboard lists are links to /dashboard?list=…, so they work from Reports or Admin too. */
export function staffSections(role: Role, counts: NavCounts = {}): NavSection[] {
  const admin = isAdminRole(role);
  const store = role === "branch";
  const item = (key: keyof NavCounts, label: string, icon: IconName, alert = false): NavItem =>
    ({ key, label, icon, count: counts[key], alert: alert && (counts[key] ?? 0) > 0, href: `/dashboard?list=${key}` });
  return [
    { title: "My work", items: [
      item("today", "Today's work", "today", true),
      item("reminders", "Tomorrow's reminders", "alarm"),
      ...(store ? [] : [item("sms", "SMS to send", "message", true)]),
      ...(admin ? [item("approvals", "Waiting for approval", "badge", true)] : []),
    ] },
    { title: "Candidates", items: [
      item("followup", "In follow-up", "users"),
      item("onboarding", "Joined · onboarding", "clipboard", store),
      item("completed", "Completed", "check"),
      item("rejected", "Rejected / dropped", "xcircle"),
      ...(store ? [] : [item("talent", "Talent pool", "star")]),
      ...(admin ? [item("reapply", "Re-Apply folder", "refresh", true)] : []),
    ] },
    { title: "More", items: [
      { key: "manpower", label: "Manpower requests", icon: "store", href: "/manpower" },
      ...(admin ? [
        { key: "reports", label: "Reports", icon: "chart", href: "/reports" } as NavItem,
        { key: "posters", label: "Hiring posters (QR)", icon: "file", href: "/careers/poster" } as NavItem,
        { key: "admin", label: "Admin settings", icon: "settings", href: "/admin" } as NavItem,
      ] : []),
    ] },
  ];
}

