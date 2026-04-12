"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { WhatsNew } from "./WhatsNew";

interface SidebarProps {
  user: { name: string; email: string };
  badges?: { inbox?: number; followups?: number };
}

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: string;
  badgeKey?: "inbox" | "followups";
}> = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/inbox", label: "Inbox", icon: "inbox", badgeKey: "inbox" },
  { href: "/deals", label: "Jobs", icon: "briefcase" },
  { href: "/contacts", label: "Clients", icon: "users" },
  { href: "/followups", label: "Follow-ups", icon: "send", badgeKey: "followups" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/activity", label: "Activity", icon: "activity" },
  { href: "/automations", label: "Automations", icon: "zap" },
  { href: "/reports", label: "Reports", icon: "bar-chart" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavIcon({ name, className }: { name: string; className?: string }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...props}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...props}>
          <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "send":
      return (
        <svg {...props}>
          <path d="m22 2-7 20-4-9-9-4z" />
          <path d="M22 2 11 13" />
        </svg>
      );
    case "bar-chart":
      return (
        <svg {...props}>
          <line x1="12" x2="12" y1="20" y2="10" />
          <line x1="18" x2="18" y1="20" y2="4" />
          <line x1="6" x2="6" y1="20" y2="14" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "activity":
      return (
        <svg {...props}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "zap":
      return (
        <svg {...props}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar({ user, badges }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  function openSearch() {
    setMobileOpen(false);
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  }

  async function logout() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
    router.refresh();
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 h-14 flex items-center gap-2.5 shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent text-accent-fg text-xs font-bold">
            AI
          </span>
          <span className="font-semibold text-sm text-fg">SMB AI Ops</span>
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 mb-2">
        <button
          type="button"
          onClick={openSearch}
          className="w-full flex items-center gap-2.5 text-xs text-fg-subtle rounded-lg border border-border px-2.5 py-2 hover:border-border-strong hover:text-fg transition-colors"
        >
          <NavIcon name="search" className="shrink-0 w-4 h-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="text-[10px] font-mono text-fg-subtle/60 border border-border rounded px-1 py-0.5 leading-none">
            &#8984;K
          </kbd>
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-1">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const badgeCount = item.badgeKey && badges ? badges[item.badgeKey] ?? 0 : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors " +
                    (active
                      ? "bg-accent/10 text-accent"
                      : "text-fg-muted hover:text-fg hover:bg-surface-2")
                  }
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon name={item.icon} className="shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-danger text-white leading-none">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 pt-4 border-t border-border">
          <Link
            href="/settings"
            className={
              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors " +
              (isActive(pathname, "/settings")
                ? "bg-accent/10 text-accent"
                : "text-fg-muted hover:text-fg hover:bg-surface-2")
            }
          >
            <NavIcon name="settings" className="shrink-0" />
            <span>Settings</span>
          </Link>
        </div>
      </nav>

      {/* Footer area */}
      <div className="px-3 pb-3 mt-auto shrink-0 space-y-3">
        <div className="flex items-center justify-between px-2.5 text-[10px] text-fg-subtle">
          <span>v0.1.0</span>
          <WhatsNew />
        </div>

        <div className="border-t border-border pt-3">
          <ThemeToggle />
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-center gap-2.5 px-1">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent/15 text-accent text-[10px] font-bold shrink-0">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-fg truncate">{user.name}</div>
              <div className="text-[10px] text-fg-subtle truncate">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={signingOut}
              className="text-fg-subtle hover:text-fg transition-colors p-1 shrink-0"
              title="Sign out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] shrink-0 border-r border-border bg-surface h-screen sticky top-0 flex-col no-print">
        {sidebarContent}
      </aside>

      {/* Mobile top bar + overlay */}
      <div className="lg:hidden sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-sm no-print">
        <div className="flex items-center justify-between h-12 px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-accent text-accent-fg text-[10px] font-bold">
              AI
            </span>
            <span className="font-semibold text-sm text-fg">SMB AI Ops</span>
          </Link>
          <button
            type="button"
            onClick={openSearch}
            className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2"
            aria-label="Search"
          >
            <NavIcon name="search" className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            ref={sidebarRef}
            className="absolute left-0 top-0 bottom-0 w-[280px] bg-surface border-r border-border shadow-[var(--shadow-pop)]"
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
