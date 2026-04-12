import Link from "next/link";
import { WhatsNew } from "./WhatsNew";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto no-print">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-fg-subtle">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-fg-muted">SMB AI Ops</span>
          <span>v0.1.0</span>
          <WhatsNew />
        </div>
        <div className="flex items-center gap-4">
          <Link href="/settings" className="hover:text-fg transition-colors">
            Settings
          </Link>
          <Link href="/settings/privacy" className="hover:text-fg transition-colors">
            Privacy
          </Link>
          <Link href="/settings/audit" className="hover:text-fg transition-colors">
            Audit log
          </Link>
          <span>Press <kbd className="px-1 py-0.5 border border-border rounded bg-surface-2 text-[10px]">?</kbd> for shortcuts</span>
        </div>
      </div>
    </footer>
  );
}
