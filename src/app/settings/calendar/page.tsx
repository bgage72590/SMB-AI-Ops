import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getUserById } from "@/lib/store";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { CalendarActions } from "@/components/CalendarActions";
import { hasFeature } from "@/lib/plans";
import { UpgradeNotice } from "@/components/UpgradeNotice";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const fresh = getUserById(user.id);
  if (!fresh) redirect("/login");

  const googleConfigured = isGoogleCalendarConfigured();
  const connected = !!fresh.googleCalendarEnabled;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <PageHeader
        eyebrow={<Link href="/settings" className="text-accent hover:underline">Settings</Link>}
        title="Calendar"
        description="Connect your Google Calendar so the AI can propose specific times."
      />

      <Card>
        <CardHeader
          title="Google Calendar"
          subtitle={connected ? "Connected" : "Not connected"}
        />
        <CardBody className="space-y-4">
          <p className="text-sm text-fg-muted">
            When connected, the AI reads your free/busy schedule (not event
            details) before drafting scheduling replies. Instead of
            &ldquo;what works for you?&rdquo; your drafts will propose
            specific open time slots.
          </p>

          {!googleConfigured && (
            <p className="text-xs text-fg-subtle">
              Set <code className="text-fg font-mono">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="text-fg font-mono">GOOGLE_CLIENT_SECRET</code> in your{" "}
              <code className="text-fg font-mono">.env</code> to enable this feature.
            </p>
          )}

          {googleConfigured &&
            (hasFeature(fresh, "calendar_sync") || connected ? (
              <CalendarActions connected={connected} />
            ) : (
              <UpgradeNotice feature="calendar_sync" label="Google Calendar sync" />
            ))}
        </CardBody>
      </Card>
    </main>
  );
}
