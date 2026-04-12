import Link from "next/link";
import { ProcessButton } from "@/components/ProcessButton";
import {
  CategoryBadge,
  PriorityBadge,
} from "@/components/Badge";
import { InboxThreadView } from "@/components/InboxThreadView";
import type { ThreadEmail } from "@/components/InboxThreadView";
import { Pagination, paginate } from "@/components/Pagination";
import { listEmails, getContact } from "@/lib/store";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import type { Email, EmailCategory } from "@/lib/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inbox | SMB AI Ops",
  description: "Triage and manage inbound emails with AI.",
};

export const dynamic = "force-dynamic";

type Filter = "all" | "unprocessed" | "new_lead" | "deal_update";
type View = "flat" | "threaded";

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
  searchParams?: { filter?: string; page?: string; view?: string };
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

  const activeView: View = searchParams?.view === "threaded" ? "threaded" : "flat";

  const filteredUnprocessed = applyFilter(unprocessed, activeFilter);
  const filteredProcessed = applyFilter(processed, activeFilter);
  const showUnprocessed = activeFilter !== "deal_update";
  const showProcessed = activeFilter !== "unprocessed";

  const page = parseInt(searchParams?.page || "1", 10);
  const paginatedProcessed = paginate(filteredProcessed, page, PER_PAGE);

  const filterParams: Record<string, string> = {};
  if (activeFilter !== "all") filterParams.filter = activeFilter;
  if (activeView !== "flat") filterParams.view = activeView;

  const threadEmails: ThreadEmail[] = filteredProcessed.map((e) => {
    const contact = e.contactId ? getContact(user.id, e.contactId) : undefined;
    return {
      id: e.id,
      from: e.from,
      fromName: e.fromName,
      subject: e.subject,
      body: e.body,
      receivedAt: e.receivedAt,
      category: e.category,
      priority: e.priority,
      summary: e.summary,
      contactId: e.contactId,
      contactName: contact?.name,
    };
  });

  function viewHref(v: View) {
    const params = new URLSearchParams();
    if (activeFilter !== "all") params.set("filter", activeFilter);
    if (v !== "flat") params.set("view", v);
    const qs = params.toString();
    return "/inbox" + (qs ? `?${qs}` : "");
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Inbox</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            {unprocessed.length} waiting &middot; {processed.length} triaged by AI
          </p>
        </div>
        <ProcessButton />
      </div>

      {/* Filter chips + view toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => {
            const isActive = f.id === activeFilter;
            const params = new URLSearchParams();
            if (f.id !== "all") params.set("filter", f.id);
            if (activeView !== "flat") params.set("view", activeView);
            const qs = params.toString();
            const href = "/inbox" + (qs ? `?${qs}` : "");
            return (
              <Link
                key={f.id}
                href={href}
                className={
                  "inline-flex items-center h-7 px-3 rounded-full text-xs font-medium border transition-colors " +
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

        {/* View toggle */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <Link
            href={viewHref("flat")}
            className={
              "px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
              (activeView === "flat"
                ? "bg-accent text-accent-fg"
                : "text-fg-muted hover:text-fg hover:bg-surface-2")
            }
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5 mr-1">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Flat
          </Link>
          <Link
            href={viewHref("threaded")}
            className={
              "px-2.5 py-1.5 text-[11px] font-medium transition-colors border-l border-border " +
              (activeView === "threaded"
                ? "bg-accent text-accent-fg"
                : "text-fg-muted hover:text-fg hover:bg-surface-2")
            }
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5 mr-1">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Threads
          </Link>
        </div>
      </div>

      {/* Empty inbox */}
      {emails.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface py-16 text-center">
          <div className="text-2xl mb-2">&#128236;</div>
          <div className="text-sm font-medium text-fg">Your inbox is empty</div>
          <p className="text-xs text-fg-subtle mt-1 max-w-sm mx-auto">
            Once inbound email is routed in, messages will appear here for the AI to triage.
          </p>
          <div className="mt-4">
            <ProcessButton label="Process inbox" />
          </div>
        </div>
      )}

      {/* Waiting for triage */}
      {emails.length > 0 && showUnprocessed && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-fg">Waiting for triage</h2>
              <p className="text-xs text-fg-subtle mt-0.5">
                {filteredUnprocessed.length === 0
                  ? "All caught up"
                  : `${filteredUnprocessed.length} message${filteredUnprocessed.length === 1 ? "" : "s"} pending`}
              </p>
            </div>
            {filteredUnprocessed.length > 0 && (
              <ProcessButton label={`Process ${filteredUnprocessed.length}`} />
            )}
          </div>

          {filteredUnprocessed.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg-subtle">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10 text-success text-xs">&#10003;</span>
              Every message has been triaged.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] divide-y divide-border overflow-hidden">
              {filteredUnprocessed.map((email) => (
                <div
                  key={email.id}
                  className="px-4 py-3 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-fg">
                          {email.fromName || email.from}
                        </span>
                        {email.fromName && (
                          <span className="text-[11px] text-fg-subtle">{email.from}</span>
                        )}
                        <span className="text-[11px] text-fg-subtle">&middot; {formatRelative(email.receivedAt)}</span>
                      </div>
                      <div className="text-sm text-fg-muted mt-0.5">{email.subject}</div>
                      <p className="text-xs text-fg-subtle mt-1 line-clamp-2">
                        {email.body}
                      </p>
                    </div>
                    <ProcessButton
                      emailId={email.id}
                      label="Triage"
                      variant="ghost"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Triaged by AI */}
      {emails.length > 0 && showProcessed && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-fg">Triaged by AI</h2>
              <p className="text-xs text-fg-subtle mt-0.5">
                {filteredProcessed.length === 0
                  ? "No messages match this filter"
                  : `${filteredProcessed.length} message${filteredProcessed.length === 1 ? "" : "s"} categorized`}
              </p>
            </div>
          </div>

          {filteredProcessed.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg-subtle">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent text-xs">&#9734;</span>
              No triaged messages for this filter.
            </div>
          ) : activeView === "threaded" ? (
            <InboxThreadView emails={threadEmails} />
          ) : (
            <>
              <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] divide-y divide-border overflow-hidden">
                {paginatedProcessed.items.map((email) => (
                  <div
                    key={email.id}
                    className="px-4 py-3 hover:bg-surface-2/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-fg">
                            {email.fromName || email.from}
                          </span>
                          {email.category && <CategoryBadge category={email.category} />}
                          {email.priority && <PriorityBadge priority={email.priority} />}
                        </div>
                        <div className="text-xs text-fg-muted mt-0.5">{email.subject}</div>
                        {email.summary && email.summary !== email.subject && (
                          <div className="text-xs text-fg-subtle mt-0.5 line-clamp-1 italic">
                            {email.summary}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-fg-subtle whitespace-nowrap shrink-0 mt-0.5">
                        {formatRelative(email.receivedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination
                currentPage={paginatedProcessed.currentPage}
                totalPages={paginatedProcessed.totalPages}
                basePath="/inbox"
                searchParams={filterParams}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
