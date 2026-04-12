import Link from "next/link";

interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-fg-subtle">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-fg transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-fg-muted font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
