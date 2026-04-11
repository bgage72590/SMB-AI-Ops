import Link from "next/link";
import { UserMenu } from "./UserMenu";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/deals", label: "Deals" },
  { href: "/contacts", label: "Contacts" },
  { href: "/followups", label: "Follow-ups" },
];

export function Nav({
  user,
}: {
  user?: { name: string; email: string } | null;
}) {
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white font-bold">
            AI
          </span>
          <span className="font-semibold text-ink-900">SMB AI Ops</span>
          <span className="text-xs text-ink-400 ml-2 hidden sm:inline">
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
                  className="px-3 py-1.5 rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-50"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <span
                className="hidden md:inline-flex items-center gap-1 text-[11px] text-ink-400 border border-ink-100 rounded-md px-2 py-1"
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
                className="px-3 py-1.5 rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-50"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent/90"
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
