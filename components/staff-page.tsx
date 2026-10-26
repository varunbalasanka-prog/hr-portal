import { staffSections } from "@/lib/nav";
import type { Profile } from "@/lib/types";
import { AppShell, PageHeader } from "./app-shell";

/** Shell for the staff pages outside the dashboard (Reports, Admin, Manpower). */
export function StaffPage({ me, active, title, subtitle, actions, children }: {
  me: Profile; active: string; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <AppShell me={me} sections={staffSections(me.role)} active={active}>
      <main className="pb-10">
        <PageHeader title={title} subtitle={subtitle}>{actions}</PageHeader>
        {children}
      </main>
    </AppShell>
  );
}
