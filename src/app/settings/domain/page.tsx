import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { DomainVerifier } from "@/components/DomainVerifier";

export const dynamic = "force-dynamic";

export default async function DomainPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <PageHeader
        eyebrow={<Link href="/settings" className="text-accent hover:underline">Settings</Link>}
        title="Email deliverability"
        description="Verify your domain's DNS records so follow-up emails don't land in spam."
      />

      <Card className="border-warning/30 bg-warning-soft/30">
        <CardBody>
          <p className="text-sm text-fg">
            <strong>Why this matters:</strong> Without proper SPF, DKIM, and
            DMARC records, emails sent from your domain are more likely to be
            flagged as spam. This wizard checks your DNS configuration and
            tells you exactly what to fix.
          </p>
          <p className="text-sm text-fg-muted mt-2">
            You only need to do this if you're sending follow-ups from your
            own domain. If you're using the default noreply address, SendGrid
            handles deliverability for you.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="DNS verification"
          subtitle="Check your domain's email records"
        />
        <CardBody>
          <DomainVerifier />
        </CardBody>
      </Card>
    </main>
  );
}
