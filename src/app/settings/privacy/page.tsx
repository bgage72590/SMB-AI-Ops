import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listBlocklistEntries } from "@/lib/store";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { BlocklistManager } from "@/components/BlocklistManager";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const entries = listBlocklistEntries(user.id);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <PageHeader
        eyebrow={<Link href="/settings" className="text-accent hover:underline">Settings</Link>}
        title="Privacy & Permissions"
        description="Control which emails the AI can see and process."
      />

      <Card className="border-warning/30 bg-warning-soft/30">
        <CardBody>
          <p className="text-sm text-fg">
            <strong>How it works:</strong> Every email forwarded to your AI
            inbox is sent to Anthropic's Claude API for triage and follow-up
            drafting. The email subject, body, and sender info are included in
            the prompt. No email data is stored by Anthropic after processing.
          </p>
          <p className="text-sm text-fg-muted mt-2">
            Use the blocklist below to prevent specific senders or domains from
            being processed. Blocked emails are marked as processed but never
            sent to the AI.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Sender blocklist"
          subtitle={`${entries.length} blocked`}
        />
        <CardBody>
          <BlocklistManager
            initialEntries={entries.map((e) => ({
              id: e.id,
              pattern: e.pattern,
              reason: e.reason,
              createdAt: e.createdAt,
            }))}
          />
        </CardBody>
      </Card>
    </main>
  );
}
