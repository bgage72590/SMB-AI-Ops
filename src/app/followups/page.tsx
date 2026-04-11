import { FollowUpActions } from "@/components/FollowUpActions";
import { getContact, getDeal, listFollowUps } from "@/lib/store";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function FollowUpsPage() {
  const followUps = listFollowUps();
  const drafts = followUps.filter((f) => f.status === "draft");
  const rest = followUps.filter((f) => f.status !== "draft");

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-ink-900">Follow-ups</h1>
        <p className="text-ink-500 mt-1">
          AI-drafted replies waiting for your approval.
        </p>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-400 mb-3">
          Drafts ({drafts.length})
        </h2>
        {drafts.length === 0 ? (
          <div className="card p-6 text-sm text-ink-400 text-center">
            No drafts right now. Process your inbox to generate some.
          </div>
        ) : (
          <ul className="space-y-4">
            {drafts.map((f) => {
              const contact = getContact(f.contactId);
              const deal = f.dealId ? getDeal(f.dealId) : undefined;
              return (
                <li key={f.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-ink-400">
                        To: {contact?.name || "Unknown"}{" "}
                        <span className="text-ink-300">
                          &lt;{contact?.email}&gt;
                        </span>
                        {deal && (
                          <span className="ml-2 text-ink-500">
                            · {deal.title}
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-ink-900 mt-1">
                        {f.subject}
                      </div>
                      <pre className="text-sm text-ink-700 mt-3 whitespace-pre-wrap font-sans bg-ink-50 rounded-md p-3 border border-ink-100">
                        {f.draft}
                      </pre>
                      <div className="text-xs text-ink-500 mt-2 italic">
                        Why: {f.reason}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span className="text-xs text-ink-400">
                        {formatRelative(f.createdAt)}
                      </span>
                      <FollowUpActions id={f.id} currentStatus={f.status} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {rest.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-ink-400 mb-3">
            History
          </h2>
          <ul className="space-y-2">
            {rest.map((f) => {
              const contact = getContact(f.contactId);
              return (
                <li
                  key={f.id}
                  className="card p-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-ink-900 truncate">
                      {f.subject}
                    </div>
                    <div className="text-xs text-ink-500">
                      {contact?.name || "—"} · {formatRelative(f.createdAt)}
                    </div>
                  </div>
                  <FollowUpActions id={f.id} currentStatus={f.status} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
