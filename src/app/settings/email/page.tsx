import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getUserById } from "@/lib/store";
import { isGmailOAuthConfigured } from "@/lib/gmail";
import { isOutlookOAuthConfigured } from "@/lib/outlook";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { EmailConnectionActions } from "@/components/EmailConnectionActions";

export const dynamic = "force-dynamic";

export default function EmailSettingsPage({
  searchParams,
}: {
  searchParams?: { connected?: string; error?: string };
}) {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const fresh = getUserById(user.id);
  if (!fresh) redirect("/login");

  const gmailConfigured = isGmailOAuthConfigured();
  const outlookConfigured = isOutlookOAuthConfigured();
  const gmailConnected = !!fresh.gmailConnected;
  const outlookConnected = !!fresh.outlookConnected;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <PageHeader
        eyebrow={
          <Link href="/settings" className="text-accent hover:underline">
            Settings
          </Link>
        }
        title="Email Connection"
        description="Connect your email account to read messages directly — no forwarding needed."
      />

      {searchParams?.connected && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-fg">
          <strong>
            {searchParams.connected === "gmail" ? "Gmail" : "Outlook"} connected
            successfully!
          </strong>{" "}
          Your emails will sync automatically.
        </div>
      )}

      {searchParams?.error && (
        <div className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-fg">
          {searchParams.error === "oauth_denied"
            ? "Authorization was denied. Please try again."
            : "Connection failed. Please try again."}
        </div>
      )}

      {/* Gmail */}
      <Card>
        <CardHeader
          title="Gmail"
          subtitle={
            gmailConnected
              ? `Connected as ${fresh.gmailEmail || "unknown"}`
              : "Not connected"
          }
        />
        <CardBody className="space-y-4">
          <p className="text-sm text-fg-muted">
            Connect your Gmail account to import emails directly. The AI will
            read your inbox and triage customer messages — no email forwarding
            setup required.
          </p>

          {!gmailConfigured && (
            <p className="text-xs text-fg-subtle">
              Set{" "}
              <code className="text-fg font-mono">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="text-fg font-mono">GOOGLE_CLIENT_SECRET</code> in
              your <code className="text-fg font-mono">.env</code> to enable
              Gmail. These are the same keys used for Google Calendar.
            </p>
          )}

          {gmailConfigured && (
            <EmailConnectionActions
              provider="gmail"
              connected={gmailConnected}
              email={fresh.gmailEmail}
            />
          )}
        </CardBody>
      </Card>

      {/* Outlook */}
      <Card>
        <CardHeader
          title="Outlook / Microsoft 365"
          subtitle={
            outlookConnected
              ? `Connected as ${fresh.outlookEmail || "unknown"}`
              : "Not connected"
          }
        />
        <CardBody className="space-y-4">
          <p className="text-sm text-fg-muted">
            Connect your Outlook or Microsoft 365 account to import emails
            directly. Works with any Microsoft email — Outlook.com, Hotmail, or
            your company&#39;s Microsoft 365.
          </p>

          {!outlookConfigured && (
            <p className="text-xs text-fg-subtle">
              Set{" "}
              <code className="text-fg font-mono">MICROSOFT_CLIENT_ID</code>{" "}
              and{" "}
              <code className="text-fg font-mono">
                MICROSOFT_CLIENT_SECRET
              </code>{" "}
              in your <code className="text-fg font-mono">.env</code> to enable
              Outlook. Register an app at{" "}
              <a
                href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Azure AD
              </a>
              .
            </p>
          )}

          {outlookConfigured && (
            <EmailConnectionActions
              provider="outlook"
              connected={outlookConnected}
              email={fresh.outlookEmail}
            />
          )}
        </CardBody>
      </Card>

      {/* Forwarding fallback */}
      <Card>
        <CardHeader
          title="Email Forwarding"
          subtitle="Always available"
        />
        <CardBody className="space-y-3">
          <p className="text-sm text-fg-muted">
            If you prefer not to connect via OAuth, you can always forward
            emails to your AI inbox address. This works with any email provider.
          </p>
          {fresh.inboundAddress && (
            <div className="rounded-lg border border-border bg-surface-2/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-semibold mb-1">
                Your AI inbox address
              </div>
              <code className="text-sm text-fg font-mono">
                {fresh.inboundAddress}
              </code>
            </div>
          )}
          <Link
            href="/onboarding"
            className="text-xs text-accent hover:underline"
          >
            Set up email forwarding
          </Link>
        </CardBody>
      </Card>
    </main>
  );
}
