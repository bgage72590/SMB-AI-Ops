import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getUserById } from "@/lib/store";
import { isSlackAppConfigured } from "@/lib/slack";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { SlackActions } from "@/components/SlackActions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  oauth_denied: "Slack install was cancelled.",
  oauth_state: "That install link expired or didn't start here. Try again.",
  oauth_failed: "Slack didn't complete the install. Try again.",
  channel_taken: "That Slack channel is already connected to another workspace.",
};

export default async function SlackPage(props: {
  searchParams?: Promise<{ connected?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const fresh = getUserById(user.id);
  if (!fresh) redirect("/login");

  const appConfigured = isSlackAppConfigured();
  const error = searchParams?.error ? ERRORS[searchParams.error] ?? ERRORS.oauth_failed : null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <PageHeader
        eyebrow={<Link href="/settings" className="text-accent hover:underline">Settings</Link>}
        title="Slack"
        description="Get new-lead alerts in Slack, and triage messages from one channel."
      />

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <Card>
        <CardHeader
          title="Slack channel"
          subtitle={fresh.slackChannelName ? "Connected" : "Not connected"}
        />
        <CardBody className="space-y-4">
          <p className="text-sm text-fg-muted">
            Pick one channel when you add the app. New leads and deal updates
            are posted there, and messages people write in that channel land
            in your inbox for triage. No other channels are read.
          </p>

          {!appConfigured && (
            <p className="text-xs text-fg-subtle">
              Set <code className="text-fg font-mono">SLACK_CLIENT_ID</code>,{" "}
              <code className="text-fg font-mono">SLACK_CLIENT_SECRET</code> and{" "}
              <code className="text-fg font-mono">SLACK_SIGNING_SECRET</code> in your{" "}
              <code className="text-fg font-mono">.env</code> to enable this feature.
            </p>
          )}

          {appConfigured && <SlackActions channelName={fresh.slackChannelName} />}
        </CardBody>
      </Card>
    </main>
  );
}
