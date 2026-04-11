import { StageBadge } from "@/components/Badge";
import { getContact, listDeals } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import type { DealStage } from "@/lib/types";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const COLUMNS: DealStage[] = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export default function DealsPage() {
  const user = requireUser();
  const deals = listDeals(user.id);
  const byStage: Record<DealStage, typeof deals> = {
    lead: [],
    qualified: [],
    proposal: [],
    negotiation: [],
    won: [],
    lost: [],
  };
  for (const d of deals) byStage[d.stage].push(d);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-ink-900">Deals</h1>
        <p className="text-ink-500 mt-1">
          {deals.length} total · drag-free pipeline view
        </p>
      </section>

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        {COLUMNS.map((stage) => {
          const column = byStage[stage];
          const total = column.reduce((s, d) => s + d.amount, 0);
          return (
            <div key={stage} className="card p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-3">
                <StageBadge stage={stage} />
                <span className="text-xs text-ink-400">
                  {formatCurrency(total)}
                </span>
              </div>
              <ul className="space-y-2">
                {column.length === 0 && (
                  <li className="text-xs text-ink-300 py-2">empty</li>
                )}
                {column.map((deal) => {
                  const contact = getContact(user.id, deal.contactId);
                  return (
                    <li
                      key={deal.id}
                      className="rounded-lg border border-ink-100 p-2 bg-ink-50/50"
                    >
                      <div className="font-medium text-sm text-ink-900 truncate">
                        {deal.title}
                      </div>
                      <div className="text-xs text-ink-500 truncate">
                        {contact?.name || "—"}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-semibold text-ink-700">
                          {formatCurrency(deal.amount, deal.currency)}
                        </span>
                        <span className="text-[10px] text-ink-400">
                          {formatRelative(deal.lastActivityAt)}
                        </span>
                      </div>
                      {deal.nextStep && (
                        <div className="text-[11px] text-ink-600 mt-1 line-clamp-2">
                          → {deal.nextStep}
                        </div>
                      )}
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
