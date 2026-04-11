import Link from "next/link";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/deals", label: "Deals" },
  { href: "/contacts", label: "Contacts" },
  { href: "/followups", label: "Follow-ups" },
];

export function Nav() {
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white font-bold">
            AI
          </span>
          <span className="font-semibold text-ink-900">SMB AI Ops</span>
          <span className="text-xs text-ink-400 ml-2 hidden sm:inline">
            your AI office manager
          </span>
        </Link>
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
      </div>
    </header>
  );
}
