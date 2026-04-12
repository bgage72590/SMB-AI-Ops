import { FollowUpActions } from "@/components/FollowUpActions";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { getContact, getDeal, listFollowUps } from "@/lib/store";
import { formatRelative } from "@/lib/format";
import { isPostmarkConfigured } from "@/lib/postmark";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function FollowUpsPage() {
  const user = requireUser();
  const followUps = listFollowUps(user.id);
  const drafts = followUps.filter((f) => f.status === "draft");
  const rest = followUps.filter((f) => f.status !== "draft");
  const canSend = isPostmarkConfigured();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Follow-ups"
        title="Follow-ups"
        description="AI-drafted replies waiting for your approval."
      />

      <Card>
        <CardHeader
          title="Drafts"
          subtitle={`${drafts.length} waiting for approval`}
        />
        <CardBody>
          {drafts.length === 0 ? (
            <EmptyState
              icon="✓"
              title="No drafts right now"
              description="Process your inbox to generate AI-drafted replies for anything that needs a response."
            />
          ) : (
            <ul className="space-y-4">
              {drafts.map((f) => {
                const contact = getContact(user.id, f.contactId);
                const deal = f.dealId ? getDeal(user.id, f.dealId) : undefined;
                return (
                  <li
                    key={f.id}
                    className="rounded-lg border border-border bg-surface-2/50 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-fg-subtle">
                          To: {contact?.name || "Unknown"}{" "}
                          <span className="text-fg-subtle/70">
                            &lt;{contact?.email}&gt;
                          </span>
                          {deal && (
                            <span className="ml-2 text-fg-muted">
                              · {deal.title}
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-fg mt-1">
                          {f.subject}
                        </div>
                        <pre className="text-sm text-fg-muted mt-3 whitespace-pre-wrap font-sans bg-surface rounded-md p-3 border border-border">
                          {f.draft}
                        </pre>
                        <div className="text-xs text-fg-subtle mt-2 italic">
                          Why: {f.reason}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        <span className="text-xs text-fg-subtle">
                          {formatRelative(f.createdAt)}
                        </span>
                        <FollowUpActions
                          id={f.id}
                          currentStatus={f.status}
                          canSend={canSend}
                          sentAt={f.sentAt}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {rest.length > 0 && (
        <Card>
          <CardHeader
            title="History"
            subtitle={`${rest.length} sent or dismissed`}
          />
          <CardBody>
            <ul className="divide-y divide-border">
              {rest.map((f) => {
                const contact = getContact(user.id, f.contactId);
                return (
                  <li
                    key={f.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-fg truncate">
                        {f.subject}
                      </div>
                      <div className="text-xs text-fg-subtle">
                        {contact?.name || "—"} · {formatRelative(f.createdAt)}
                      </div>
                    </div>
                    <FollowUpActions
                      id={f.id}
                      currentStatus={f.status}
                      canSend={canSend}
                      sentAt={f.sentAt}
                    />
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
