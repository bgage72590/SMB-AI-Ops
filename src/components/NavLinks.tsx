"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

interface NavBadges {
  inbox?: number;
  followups?: number;
}

const LINKS: Array<{ href: string; label: string; badgeKey?: keyof NavBadges }> = [
  { href: "/", label: "Dashboard" },
  { href: "/inbox", label: "Inbox", badgeKey: "inbox" },
  { href: "/deals", label: "Jobs" },
  { href: "/contacts", label: "Clients" },
  { href: "/followups", label: "Follow-ups", badgeKey: "followups" },
  { href: "/reports", label: "Reports" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-danger text-white leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NavLinks({ badges }: { badges?: NavBadges }) {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-0.5 text-[13px]">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        const badgeCount = link.badgeKey && badges ? badges[link.badgeKey] ?? 0 : 0;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "px-2.5 py-1.5 rounded-md text-accent font-medium bg-accent/10"
                : "px-2.5 py-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
            }
            aria-current={active ? "page" : undefined}
          >
            {link.label}
            <Badge count={badgeCount} />
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileMenu({ badges }: { badges?: NavBadges }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const totalBadge = (badges?.inbox ?? 0) + (badges?.followups ?? 0);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className="md:hidden relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        )}
        {!open && totalBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <nav className="absolute right-0 top-full mt-2 w-48 py-2 rounded-xl bg-surface border border-border shadow-[var(--shadow-pop)] z-50">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            const badgeCount = link.badgeKey && badges ? badges[link.badgeKey] ?? 0 : 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "flex items-center justify-between px-4 py-2.5 text-sm font-medium text-accent bg-accent-soft"
                    : "flex items-center justify-between px-4 py-2.5 text-sm text-fg-muted hover:text-fg hover:bg-surface-2"
                }
                aria-current={active ? "page" : undefined}
              >
                {link.label}
                <Badge count={badgeCount} />
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
