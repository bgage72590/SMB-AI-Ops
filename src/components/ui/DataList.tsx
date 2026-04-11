import { cn } from "./cn";

// DataList is a Linear-style dense row list for inbox / deals / etc.
// It renders a header row + divided items. Callers provide a render
// function per row so each screen can lay out columns however it wants;
// DataList only owns spacing, dividers, hover states, and keyboard
// focusability.

interface DataListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string;
  /** Rendered above the items, typically column labels. */
  header?: React.ReactNode;
  /** Shown when items.length === 0. Usually an <EmptyState />. */
  empty?: React.ReactNode;
  className?: string;
}

export function DataList<T>({
  items,
  renderItem,
  getKey,
  header,
  empty,
  className,
}: DataListProps<T>) {
  if (items.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface overflow-hidden",
        className
      )}
    >
      {header && (
        <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-fg-subtle font-semibold border-b border-border bg-surface-2">
          {header}
        </div>
      )}
      <ul className="divide-y divide-border">
        {items.map((item, i) => (
          <li
            key={getKey(item, i)}
            className="px-4 py-3 hover:bg-surface-2 transition-colors"
          >
            {renderItem(item, i)}
          </li>
        ))}
      </ul>
    </div>
  );
}
