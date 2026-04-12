import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listWebhookEndpoints } from "@/lib/store";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { WebhookManager } from "@/components/WebhookManager";

export const dynamic = "force-dynamic";

export default function WebhooksPage() {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const endpoints = listWebhookEndpoints(user.id);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <PageHeader
        eyebrow={
          <Link href="/settings" className="text-accent hover:underline">
            Settings
          </Link>
        }
        title="Webhooks"
        description="Send real-time events to external tools like Zapier, Make, or your own API."
      />

      <Card>
        <CardHeader title="How it works" />
        <CardBody className="space-y-3">
          <p className="text-sm text-fg-muted">
            Add a webhook URL and choose which events to subscribe to. Every
            time one of those events fires, we&#39;ll POST a JSON payload to
            your URL with the event details.
          </p>
          <p className="text-sm text-fg-muted">
            <strong className="text-fg">For Zapier:</strong> Create a Zap with
            &ldquo;Webhooks by Zapier&rdquo; as the trigger, copy the webhook
            URL, and paste it below.
          </p>
          <details className="text-xs text-fg-subtle">
            <summary className="cursor-pointer hover:text-fg-muted">
              Available events
            </summary>
            <ul className="mt-2 space-y-0.5 pl-4 list-disc">
              <li>contact.created, contact.updated</li>
              <li>deal.created, deal.updated, deal.stage_changed</li>
              <li>email.received, email.processed</li>
              <li>followup.created, followup.sent</li>
              <li>invoice.created, invoice.status_changed</li>
            </ul>
          </details>
        </CardBody>
      </Card>

      <WebhookManager
        endpoints={endpoints.map((ep) => ({
          id: ep.id,
          url: ep.url,
          events: ep.events,
          enabled: ep.enabled,
          createdAt: ep.createdAt,
        }))}
      />
    </main>
  );
}
