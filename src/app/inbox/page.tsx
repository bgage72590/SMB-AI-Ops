import { ProcessButton } from "@/components/ProcessButton";
import {
  CategoryBadge,
  PriorityBadge,
} from "@/components/Badge";
import { listEmails } from "@/lib/store";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  const emails = listEmails();
  const unprocessed = emails.filter((e) => !e.processed);
  const processed = emails.filter((e) => e.processed);

  return (
    <div className="space-y-8">
      <section className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Inbox</h1>
          <p className="text-ink-500 mt-1">
            {unprocessed.length} unprocessed · {processed.length} triaged by AI
          </p>
        </div>
        <ProcessButton />
      </section>

      {unprocessed.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-ink-400 mb-3">
            Waiting for triage
          </h2>
          <ul className="space-y-3">
            {unprocessed.map((email) => (
              <li key={email.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-ink-900">
                      {email.fromName || email.from}
                      <span className="text-ink-400 font-normal">
                        {" "}· {email.from}
                      </span>
                    </div>
                    <div className="text-sm text-ink-700 mt-1">
                      {email.subject}
                    </div>
                    <pre className="text-xs text-ink-500 mt-2 whitespace-pre-wrap font-sans line-clamp-3">
                      {email.body}
                    </pre>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-ink-400">
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
        </section>
      )}

      {processed.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-ink-400 mb-3">
            Triaged
          </h2>
          <ul className="space-y-3">
            {processed.map((email) => (
              <li key={email.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink-900">
                        {email.fromName || email.from}
                      </span>
                      {email.category && (
                        <CategoryBadge category={email.category} />
                      )}
                      {email.priority && (
                        <PriorityBadge priority={email.priority} />
                      )}
                    </div>
                    <div className="text-sm text-ink-700 mt-1">
                      {email.subject}
                    </div>
                    {email.summary && (
                      <div className="text-sm text-ink-600 mt-2 italic">
                        “{email.summary}”
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-ink-400 whitespace-nowrap">
                    {formatRelative(email.receivedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
