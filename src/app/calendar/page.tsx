import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listDeals, listFollowUps, getContact } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import { StageBadge } from "@/components/Badge";
import { CalendarGrid } from "@/components/CalendarGrid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendar | SMB AI Ops",
  description: "Visual schedule for jobs and follow-ups.",
};

export const dynamic = "force-dynamic";

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  kind: "scheduled" | "followup" | "completed";
  href?: string;
}

export default function CalendarPage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  if (searchParams?.month) {
    const [y, m] = searchParams.month.split("-").map(Number);
    if (y && m && m >= 1 && m <= 12) {
      viewYear = y;
      viewMonth = m - 1;
    }
  }

  const deals = listDeals(user.id);
  const followUps = listFollowUps(user.id);

  const events: CalendarEvent[] = [];

  for (const deal of deals) {
    if (deal.stage === "scheduled" || deal.stage === "in_progress") {
      const contact = getContact(user.id, deal.contactId);
      events.push({
        id: `deal-${deal.id}`,
        date: deal.lastActivityAt.split("T")[0],
        title: deal.title,
        subtitle: contact?.name,
        kind: "scheduled",
        href: `/deals/${deal.id}`,
      });
    }
    if (deal.stage === "completed") {
      const contact = getContact(user.id, deal.contactId);
      events.push({
        id: `done-${deal.id}`,
        date: deal.updatedAt.split("T")[0],
        title: deal.title,
        subtitle: formatCurrency(deal.amount, deal.currency),
        kind: "completed",
        href: `/deals/${deal.id}`,
      });
    }
  }

  for (const f of followUps) {
    if (f.scheduledFor) {
      const contact = getContact(user.id, f.contactId);
      events.push({
        id: `fu-${f.id}`,
        date: f.scheduledFor.split("T")[0],
        title: f.subject,
        subtitle: contact?.name,
        kind: "followup",
        href: "/followups",
      });
    }
  }

  const prevMonth = viewMonth === 0
    ? `${viewYear - 1}-12`
    : `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  const nextMonth = viewMonth === 11
    ? `${viewYear + 1}-01`
    : `${viewYear}-${String(viewMonth + 2).padStart(2, "0")}`;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">Calendar</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Scheduled jobs and follow-ups
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${prevMonth}`}
            className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <span className="text-sm font-semibold text-fg min-w-[140px] text-center">
            {monthNames[viewMonth]} {viewYear}
          </span>
          <Link
            href={`/calendar?month=${nextMonth}`}
            className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </div>

      <CalendarGrid year={viewYear} month={viewMonth} events={events} />

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-fg-subtle px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-info" />
          <span>Follow-up</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-success" />
          <span>Completed</span>
        </div>
      </div>
    </div>
  );
}
