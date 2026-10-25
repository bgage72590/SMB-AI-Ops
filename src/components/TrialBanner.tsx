import Link from "next/link";
import type { TrialStatus } from "@/lib/trial";

interface Props {
  trial: TrialStatus;
}

export function TrialBanner({ trial }: Props) {
  if (trial.isPaid) return null;

  if (trial.isExpired) {
    return (
      <div className="border border-danger/40 bg-danger-soft rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-fg">
            Your free trial has ended
          </p>
          <p className="text-xs text-fg-muted mt-0.5">
            You&apos;re on the Free plan now: 25 emails a month, no texting
            or reports. Upgrade to get them back.
          </p>
        </div>
        <Link
          href="/settings"
          className="shrink-0 inline-flex items-center h-8 px-4 text-xs font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 transition-opacity"
        >
          Upgrade now
        </Link>
      </div>
    );
  }

  if (trial.isTrialing && trial.daysRemaining <= 5) {
    return (
      <div className="border border-warning/40 bg-warning-soft rounded-xl p-4 flex items-center justify-between gap-4">
        <p className="text-sm text-fg">
          <strong>{trial.daysRemaining} day{trial.daysRemaining === 1 ? "" : "s"}</strong>{" "}
          left on your free trial.{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Upgrade
          </Link>{" "}
          to keep full access after it moves to the Free plan.
        </p>
      </div>
    );
  }

  return null;
}
