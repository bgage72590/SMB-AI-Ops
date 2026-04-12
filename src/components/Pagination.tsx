import Link from "next/link";

interface Props {
  currentPage: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string>;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  searchParams = {},
}: Props) {
  if (totalPages <= 1) return null;

  function buildHref(page: number) {
    const params = new URLSearchParams(searchParams);
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const pages: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return (
    <nav
      className="flex items-center justify-center gap-1 pt-4"
      aria-label="Pagination"
    >
      {currentPage > 1 && (
        <Link
          href={buildHref(currentPage - 1)}
          className="px-2.5 py-1.5 text-xs font-medium rounded-md text-fg-muted hover:text-fg hover:bg-surface-2"
          aria-label="Previous page"
        >
          &larr; Prev
        </Link>
      )}
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e${i}`} className="px-1.5 text-xs text-fg-subtle">
            &hellip;
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={
              p === currentPage
                ? "px-2.5 py-1.5 text-xs font-medium rounded-md bg-accent text-accent-fg"
                : "px-2.5 py-1.5 text-xs font-medium rounded-md text-fg-muted hover:text-fg hover:bg-surface-2"
            }
            aria-current={p === currentPage ? "page" : undefined}
          >
            {p}
          </Link>
        )
      )}
      {currentPage < totalPages && (
        <Link
          href={buildHref(currentPage + 1)}
          className="px-2.5 py-1.5 text-xs font-medium rounded-md text-fg-muted hover:text-fg hover:bg-surface-2"
          aria-label="Next page"
        >
          Next &rarr;
        </Link>
      )}
    </nav>
  );
}

export function paginate<T>(items: T[], page: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    currentPage: safePage,
    totalPages,
    totalItems: items.length,
  };
}
