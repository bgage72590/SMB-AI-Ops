import Link from "next/link";
import { StageBadge } from "@/components/Badge";
import { PageHeader, StatCard } from "@/components/ui";
import { getContact, listDeals } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import type { DealStage } from "@/lib/types";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Left-to-right: the lifecycle a local-service job moves through.
// `completed` and `lost` are terminal columns we still render so the
// owner can glance at the week's won/lost work.
const COLUMNS: Array<{ stage: DealStage; label: string }> = [
  { stage: "inquiry", label: "Inquiries" },
  { stage: "quoted", label: "Quoted" },
  { stage: "scheduled", label: "Scheduled" },
  { stage: "in_progress", label: "In progress" },
  { stage: "completed", label: "Completed" },
  { stage: "lost", label: "Lost" },
];

export default function JobsPage() {
  const user = requireUser();
  const deals = listDeals(user.id);
  const byStage: Record<DealStage, typeof deals> = {
    inquiry: [],
    quoted: [],
    scheduled: [],
    in_progress: [],
    completed: [],
    lost: [],
  };
  for (const d of deals) byStage[d.stage].push(d);

  const openDeals = deals.filter(
    (d) => d.stage !== "completed" && d.stage !== "lost"
  );
  const openValue = openDeals.reduce((sum, d) => sum + d.amount, 0);
  const bookedValue = byStage.completed.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pipeline"
        title="Jobs"
        description={`${deals.length} total · ${openDeals.length} still open`}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Open pipeline"
          value={formatCurrency(openValue)}
          hint={`${openDeals.length} job${openDeals.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Booked"
          value={formatCurrency(bookedValue)}
          hint={`${byStage.completed.length} completed`}
        />
        <StatCard
          label="Scheduled"
          value={byStage.scheduled.length}
          hint="on the books"
        />
        <StatCard
          label="Quoted"
          value={byStage.quoted.length}
          hint="awaiting reply"
        />
      </section>

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        {COLUMNS.map(({ stage, label }) => {
          const column = byStage[stage];
          const total = column.reduce((s, d) => s + d.amount, 0);
          return (
            <div
              key={stage}
              className="bg-surface border border-border rounded-xl p-3 min-h-[220px] shadow-card flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <StageBadge stage={stage} />
                  <span className="text-[11px] text-fg-subtle tabular-nums">
                    {column.length}
                  </span>
                </div>
                <span className="text-[11px] text-fg-subtle tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
              <ul className="space-y-2 flex-1">
                {column.length === 0 && (
                  <li className="text-[11px] text-fg-subtle py-2 italic">
                    {label.toLowerCase()} is empty
                  </li>
                )}
                {column.map((deal) => {
                  const contact = getContact(user.id, deal.contactId);
                  return (
                    <li key={deal.id}>
                      <Link
                        href={`/deals/${deal.id}`}
                        className="block rounded-lg border border-border p-3 bg-surface-2/60 hover:bg-surface hover:border-accent/40 transition"
                      >
                        <div className="font-medium text-sm text-fg truncate">
                          {deal.title}
                        </div>
                        <div className="text-xs text-fg-muted truncate mt-0.5">
                          {contact?.name || "—"}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-semibold text-fg tabular-nums">
                            {formatCurrency(deal.amount, deal.currency)}
                          </span>
                          <span className="text-[10px] text-fg-subtle">
                            {formatRelative(deal.lastActivityAt)}
                          </span>
                        </div>
                        {deal.nextStep && (
                          <div className="text-[11px] text-fg-muted mt-1.5 line-clamp-2 border-t border-border pt-1.5">
                            → {deal.nextStep}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
