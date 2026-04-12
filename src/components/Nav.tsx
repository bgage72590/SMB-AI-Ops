import Link from "next/link";
import { UserMenu } from "./UserMenu";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/deals", label: "Jobs" },
  { href: "/contacts", label: "Clients" },
  { href: "/followups", label: "Follow-ups" },
  { href: "/reports", label: "Reports" },
];

export function Nav({
  user,
}: {
  user?: { name: string; email: string } | null;
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-accent-fg font-bold">
            AI
          </span>
          <span className="font-semibold text-fg">SMB AI Ops</span>
          <span className="text-xs text-fg-subtle ml-2 hidden sm:inline">
            your AI office manager
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <nav className="flex items-center gap-1 text-sm">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <span
                className="hidden md:inline-flex items-center gap-1 text-[11px] text-fg-subtle border border-border rounded-md px-2 py-1"
                title="Press Cmd-K or Ctrl-K to search"
              >
                <span>Search</span>
                <kbd className="font-mono">⌘K</kbd>
              </span>
              <UserMenu name={user.name} email={user.email} />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
