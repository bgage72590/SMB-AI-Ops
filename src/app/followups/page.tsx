import { FollowUpActions } from "@/components/FollowUpActions";
import { DraftReviewList } from "@/components/DraftReviewList";
import { getContact, getDeal, listFollowUps } from "@/lib/store";
import { formatRelative } from "@/lib/format";
import { isEmailConfigured } from "@/lib/sendgrid";
import { canSendSms as canSendSmsFor } from "@/lib/twilio";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";
import { hasFeature } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Follow-ups | SMB AI Ops",
  description: "Review and send AI-drafted follow-up emails.",
};

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const user = await requireUser();
  const followUps = listFollowUps(user.id);
  const drafts = followUps.filter((f) => f.status === "draft");
  const rest = followUps.filter((f) => f.status !== "draft");
  const canSend = isEmailConfigured();
  const canSendSms = canSendSmsFor(user);

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
      hasIcs: !!f.icsData && hasFeature(user, "calendar_ics"),
      channel: f.channel ?? "email",
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-fg">Follow-ups</h1>
        <p className="text-sm text-fg-muted mt-0.5">
          {drafts.length === 0
            ? "No drafts waiting — you're all caught up."
            : `${drafts.length} draft${drafts.length === 1 ? "" : "s"} waiting for your approval.`}
        </p>
      </div>

      {/* Drafts */}
      <section>
        <h2 className="text-sm font-semibold text-fg mb-3">Drafts</h2>
        {drafts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg-subtle">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10 text-success text-xs">&#10003;</span>
            No drafts right now — process your inbox to generate AI-drafted replies.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
            <DraftReviewList drafts={draftData} canSend={canSend} />
          </div>
        )}
      </section>

      {/* History */}
      {rest.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-fg">History</h2>
            <span className="text-xs text-fg-subtle">{rest.length} sent or dismissed</span>
          </div>
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] divide-y divide-border overflow-hidden">
            {rest.map((f) => {
              const contact = getContact(user.id, f.contactId);
              return (
                <div
                  key={f.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-fg truncate">{f.subject}</div>
                    <div className="text-xs text-fg-subtle mt-0.5">
                      {contact?.name || "&mdash;"} &middot; {formatRelative(f.createdAt)}
                      {f.channel === "sms" && (
                        <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent">
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
                    hasIcs={!!f.icsData && hasFeature(user, "calendar_ics")}
                    channel={f.channel}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
