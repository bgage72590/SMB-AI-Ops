import Link from "next/link";
import { ProcessButton } from "@/components/ProcessButton";
import {
  CategoryBadge,
  PriorityBadge,
} from "@/components/Badge";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { Pagination, paginate } from "@/components/Pagination";
import { listEmails } from "@/lib/store";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import type { Email, EmailCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

type Filter = "all" | "unprocessed" | "new_lead" | "deal_update";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unprocessed", label: "Unprocessed" },
  { id: "new_lead", label: "New inquiries" },
  { id: "deal_update", label: "Job updates" },
];

function applyFilter(emails: Email[], filter: Filter): Email[] {
  if (filter === "all") return emails;
  if (filter === "unprocessed") return emails.filter((e) => !e.processed);
  return emails.filter((e) => e.category === (filter as EmailCategory));
}

const PER_PAGE = 20;

export default function InboxPage({
  searchParams,
}: {
  searchParams?: { filter?: string; page?: string };
}) {
  const user = requireUser();
  const emails = listEmails(user.id);
  const unprocessed = emails.filter((e) => !e.processed);
  const processed = emails.filter((e) => e.processed);

  const activeFilter = (
    FILTERS.some((f) => f.id === searchParams?.filter)
      ? searchParams!.filter
      : "all"
  ) as Filter;

  const filteredUnprocessed = applyFilter(unprocessed, activeFilter);
  const filteredProcessed = applyFilter(processed, activeFilter);
  const showUnprocessed = activeFilter !== "deal_update";
  const showProcessed = activeFilter !== "unprocessed";

  const page = parseInt(searchParams?.page || "1", 10);
  const paginatedProcessed = paginate(filteredProcessed, page, PER_PAGE);

  const filterParams: Record<string, string> = {};
  if (activeFilter !== "all") filterParams.filter = activeFilter;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inbox"
        title="Inbox"
        description={`${unprocessed.length} waiting \u00b7 ${processed.length} triaged by AI`}
        actions={<ProcessButton />}
      />

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const isActive = f.id === activeFilter;
          const href = f.id === "all" ? "/inbox" : `/inbox?filter=${f.id}`;
          return (
            <Link
              key={f.id}
              href={href}
              className={
                "inline-flex items-center h-8 px-3 rounded-full text-xs font-medium border transition-colors " +
                (isActive
                  ? "bg-accent text-accent-fg border-accent"
                  : "bg-surface text-fg-muted border-border hover:text-fg hover:bg-surface-2")
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {emails.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              icon="\ud83d\udcec"
              title="Your inbox is empty"
              description="Once inbound email is routed in (or once the seed is loaded), messages will appear here for the AI to triage."
              action={<ProcessButton label="Process inbox" />}
            />
          </CardBody>
        </Card>
      )}

      {emails.length > 0 && showUnprocessed && (
        <Card>
          <CardHeader
            title="Waiting for triage"
            subtitle={
              filteredUnprocessed.length === 0
                ? "Nothing waiting"
                : `${filteredUnprocessed.length} message${
                    filteredUnprocessed.length === 1 ? "" : "s"
                  } the AI hasn\u2019t looked at yet`
            }
            action={
              filteredUnprocessed.length > 0 ? (
                <ProcessButton
                  label={`Process ${filteredUnprocessed.length}`}
                />
              ) : undefined
            }
          />
          <CardBody>
            {filteredUnprocessed.length === 0 ? (
              <EmptyState
                icon="\u2713"
                title="All clear"
                description="Every message in this view has been triaged."
              />
            ) : (
              <ul className="space-y-3">
                {filteredUnprocessed.map((email) => (
                  <li
                    key={email.id}
                    className="rounded-lg border border-border bg-surface-2/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-medium text-fg">
                            {email.fromName || email.from}
                          </span>
                          {email.fromName && (
                            <span className="text-xs text-fg-subtle">
                              {email.from}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-fg-muted mt-1 font-medium">
                          {email.subject}
                        </div>
                        <p className="text-xs text-fg-subtle mt-2 line-clamp-3 whitespace-pre-wrap">
                          {email.body}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-[11px] text-fg-subtle whitespace-nowrap">
                          {formatRelative(email.receivedAt)}
                        </span>
                        <ProcessButton
                          emailId={email.id}
                          label="Triage"
                          variant="ghost"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {emails.length > 0 && showProcessed && (
        <Card>
          <CardHeader
            title="Triaged by AI"
            subtitle={
              filteredProcessed.length === 0
                ? "Nothing triaged for this filter"
                : `${filteredProcessed.length} message${
                    filteredProcessed.length === 1 ? "" : "s"
                  } already categorized`
            }
          />
          <CardBody>
            {filteredProcessed.length === 0 ? (
              <EmptyState
                icon="\u2728"
                title="Nothing here yet"
                description="As the AI processes inbound mail, it shows up here with a category + priority chip."
              />
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {paginatedProcessed.items.map((email) => (
                    <li
                      key={email.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {email.category && (
                            <CategoryBadge category={email.category} />
                          )}
                          {email.priority && (
                            <PriorityBadge priority={email.priority} />
                          )}
                        </div>
                        <div className="text-sm font-medium text-fg mt-1.5 truncate">
                          {email.fromName || email.from}
                        </div>
                        <div className="text-xs text-fg-muted truncate">
                          {email.subject}
                        </div>
                        {email.summary && (
                          <div className="text-xs text-fg-subtle mt-1 italic line-clamp-2">
                            &ldquo;{email.summary}&rdquo;
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-fg-subtle whitespace-nowrap shrink-0">
                        {formatRelative(email.receivedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
                <Pagination
                  currentPage={paginatedProcessed.currentPage}
                  totalPages={paginatedProcessed.totalPages}
                  basePath="/inbox"
                  searchParams={filterParams}
                />
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
