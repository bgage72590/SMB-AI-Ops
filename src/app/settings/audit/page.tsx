import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listAuditLog } from "@/lib/store";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { Pagination, paginate } from "@/components/Pagination";

export const dynamic = "force-dynamic";

const ACTION_COLORS: Record<string, string> = {
  blocked: "bg-red-500/10 text-red-600 dark:text-red-400",
  added: "bg-green-500/10 text-green-600 dark:text-green-400",
  removed: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  processed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  deal_created: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  deal_updated: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  draft_created: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  followup_sent: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
};

const PER_PAGE = 50;

export default function AuditPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const entries = listAuditLog(user.id, 500);
  const page = parseInt(searchParams?.page || "1", 10);
  const { items: pageEntries, currentPage, totalPages } = paginate(entries, page, PER_PAGE);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <PageHeader
        eyebrow={<Link href="/settings" className="text-accent hover:underline">Settings</Link>}
        title="Audit log"
        description="A timeline of every action the AI has taken on your behalf."
      />

      <Card>
        <CardHeader
          title="Activity timeline"
          subtitle={`${entries.length} event${entries.length === 1 ? "" : "s"}`}
        />
        <CardBody>
          {entries.length === 0 ? (
            <p className="text-sm text-fg-muted py-4 text-center">
              No activity yet. Process your inbox to start.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-fg-subtle border-b border-border">
                      <th className="pb-2 pr-4 font-medium">Action</th>
                      <th className="pb-2 pr-4 font-medium">Type</th>
                      <th className="pb-2 pr-4 font-medium">Detail</th>
                      <th className="pb-2 font-medium text-right">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageEntries.map((entry) => (
                      <tr key={entry.id} className="text-fg-muted">
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            ACTION_COLORS[entry.action] ?? "bg-surface-2 text-fg-subtle"
                          }`}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {entry.entityType}
                        </td>
                        <td className="py-2 pr-4 text-xs max-w-xs truncate">
                          {entry.detail ?? <span className="text-fg-subtle">-</span>}
                        </td>
                        <td className="py-2 text-right text-xs whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleDateString(undefined, {
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
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                basePath="/settings/audit"
              />
            </>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
