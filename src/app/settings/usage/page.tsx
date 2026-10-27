import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listAiUsage, sumAiUsageSince } from "@/lib/store";
import { Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { formatUsdFine } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const weekStats = sumAiUsageSince(user.id, weekAgo);
  const monthStats = sumAiUsageSince(user.id, monthAgo);
  const recentCalls = listAiUsage(user.id, 50);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <PageHeader
        eyebrow={<Link href="/settings" className="text-accent hover:underline">Settings</Link>}
        title="AI Usage"
        description="See what the AI is costing you and how it's being used."
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Cost (7d)"
          value={formatUsdFine(weekStats.totalCostUsd)}
          hint={`${weekStats.calls} call${weekStats.calls === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Cost (30d)"
          value={formatUsdFine(monthStats.totalCostUsd)}
          hint={`${monthStats.calls} call${monthStats.calls === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Input tokens (7d)"
          value={weekStats.totalInputTokens.toLocaleString()}
          hint={`${weekStats.totalCachedInputTokens.toLocaleString()} cached`}
        />
        <StatCard
          label="Output tokens (7d)"
          value={weekStats.totalOutputTokens.toLocaleString()}
        />
      </section>

      <Card>
        <CardHeader
          title="Recent AI calls"
          subtitle={`Last ${recentCalls.length} calls`}
        />
        <CardBody>
          {recentCalls.length === 0 ? (
            <p className="text-sm text-fg-muted py-4 text-center">
              No AI calls yet. Process your inbox to start.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-fg-subtle border-b border-border">
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Model</th>
                    <th className="pb-2 pr-4 font-medium text-right">In</th>
                    <th className="pb-2 pr-4 font-medium text-right">Out</th>
                    <th className="pb-2 pr-4 font-medium text-right">Cached</th>
                    <th className="pb-2 pr-4 font-medium text-right">Cost</th>
                    <th className="pb-2 font-medium text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentCalls.map((call) => (
                    <tr key={call.id} className="text-fg-muted">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          call.kind === "triage"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : call.kind === "draft"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : "bg-surface-2 text-fg-subtle"
                        }`}>
                          {call.kind}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {call.model.replace("claude-", "").replace("-20251001", "")}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {call.inputTokens.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {call.outputTokens.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {call.cachedInputTokens.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums font-medium">
                        {formatUsdFine(call.estimatedCostUsd)}
                      </td>
                      <td className="py-2 text-right text-xs">
                        {new Date(call.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
