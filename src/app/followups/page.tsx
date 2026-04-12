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
import { isTwilioConfigured } from "@/lib/twilio";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Follow-ups | SMB AI Ops",
  description: "Review and send AI-drafted follow-up emails.",
};

export const dynamic = "force-dynamic";

export default function FollowUpsPage() {
  const user = requireUser();
  const followUps = listFollowUps(user.id);
  const drafts = followUps.filter((f) => f.status === "draft");
  const rest = followUps.filter((f) => f.status !== "draft");
  const canSend = isPostmarkConfigured();
  const canSendSms = isTwilioConfigured();

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
      channel: f.channel ?? "email",
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
                        {f.channel === "sms" && (
                          <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400">
                            SMS
                          </span>
                        )}
                      </div>
                    </div>
                    <FollowUpActions
                      id={f.id}
                      currentStatus={f.status}
                      canSend={f.channel === "sms" ? canSendSms : canSend}
                      sentAt={f.sentAt}
                      hasIcs={!!f.icsData}
                      channel={f.channel}
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
