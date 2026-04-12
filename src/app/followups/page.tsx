import { FollowUpActions } from "@/components/FollowUpActions";
import { DraftReviewList } from "@/components/DraftReviewList";
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

  const draftData = drafts.map((f) => {
    const contact = getContact(user.id, f.contactId);
    const deal = f.dealId ? getDeal(user.id, f.dealId) : undefined;
    return {
      id: f.id,
      contactName: contact?.name || "Unknown",
      contactEmail: contact?.email || "",
      dealTitle: deal?.title,
      subject: f.subject,
      draft: f.draft,
      reason: f.reason,
      createdAt: formatRelative(f.createdAt),
      hasIcs: !!f.icsData,
    };
  });

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
            <DraftReviewList drafts={draftData} canSend={canSend} />
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
                      hasIcs={!!f.icsData}
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
