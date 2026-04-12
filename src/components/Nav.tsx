import Link from "next/link";
import { UserMenu } from "./UserMenu";
import { NavLinks, MobileMenu } from "./NavLinks";
import { SearchTrigger } from "./SearchTrigger";

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
    <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-40">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[300] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-accent-fg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent text-accent-fg text-xs font-bold">
            AI
          </span>
          <span className="font-semibold text-sm text-fg hidden sm:inline">SMB AI Ops</span>
        </Link>

        {/* Center: nav links (desktop only) */}
        {user && <NavLinks badges={badges} />}

        {/* Right side */}
        <div className="flex items-center gap-1.5">
          {user && <MobileMenu badges={badges} />}
          {user ? (
            <>
              <SearchTrigger />
              <UserMenu name={user.name} email={user.email} />
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1.5 rounded-md bg-accent text-accent-fg hover:opacity-90 transition-opacity"
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
