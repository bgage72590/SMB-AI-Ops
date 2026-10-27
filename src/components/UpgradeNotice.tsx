import Link from "next/link";
import { tierForFeature, type Feature } from "@/lib/plans";

interface Props {
  feature: Feature;
  /** What the feature is, e.g. "Pipeline reports". */
  label: string;
}

/** Shown in place of a feature the account's plan doesn't include. */
export function UpgradeNotice({ feature, label }: Props) {
  const tier = tierForFeature(feature);
  const plan = tier[0].toUpperCase() + tier.slice(1);
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg-muted flex items-center justify-between gap-4">
      <span>
        {label} {label.endsWith("s") ? "are" : "is"} part of the{" "}
        <strong className="text-fg">{plan}</strong> plan.
      </span>
      <Link
        href="/settings"
        className="shrink-0 inline-flex items-center h-8 px-4 text-xs font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 transition-opacity"
      >
        Upgrade
      </Link>
    </div>
  );
}
