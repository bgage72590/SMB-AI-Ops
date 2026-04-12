import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listAutomations } from "@/lib/store";
import { AutomationBuilder } from "@/components/AutomationBuilder";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automations | SMB AI Ops",
  description: "Set up automated workflows for your business.",
};

export const dynamic = "force-dynamic";

export default function AutomationsPage() {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const automations = listAutomations(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">Automations</h1>
        <p className="text-sm text-fg-muted mt-0.5">
          {automations.length === 0
            ? "Create rules to automate repetitive tasks."
            : `${automations.length} automation${automations.length === 1 ? "" : "s"} configured.`}
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] p-5">
        <h2 className="text-sm font-semibold text-fg mb-3">How automations work</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="flex gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-bold shrink-0">1</span>
            <div>
              <div className="text-sm font-medium text-fg">Trigger</div>
              <div className="text-xs text-fg-muted mt-0.5">Choose what event starts the automation</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-bold shrink-0">2</span>
            <div>
              <div className="text-sm font-medium text-fg">Conditions</div>
              <div className="text-xs text-fg-muted mt-0.5">Set filters like time delays or stages</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-bold shrink-0">3</span>
            <div>
              <div className="text-sm font-medium text-fg">Action</div>
              <div className="text-xs text-fg-muted mt-0.5">What happens when conditions are met</div>
            </div>
          </div>
        </div>
      </div>

      <AutomationBuilder automations={automations} />
    </div>
  );
}
