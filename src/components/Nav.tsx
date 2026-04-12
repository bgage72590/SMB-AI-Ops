import Link from "next/link";
import { UserMenu } from "./UserMenu";
import { NavLinks, MobileMenu } from "./NavLinks";

interface NavBadges {
  inbox?: number;
  followups?: number;
}

export function Nav({
  user,
  badges,
}: {
  user?: { name: string; email: string } | null;
  badges?: NavBadges;
}) {
  return (
    <header className="border-b border-border bg-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[300] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-accent-fg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
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
          {user && <NavLinks badges={badges} />}
          {user && <MobileMenu badges={badges} />}
          {user ? (
            <div className="flex items-center gap-3">
              <span
                className="hidden md:inline-flex items-center gap-1 text-[11px] text-fg-subtle border border-border rounded-md px-2 py-1"
                title="Press Cmd-K or Ctrl-K to search"
              >
                <span>Search</span>
                <kbd className="font-mono">{"\u2318"}K</kbd>
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
