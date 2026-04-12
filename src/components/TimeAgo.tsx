"use client";

import { formatRelative } from "@/lib/format";

interface Props {
  iso: string;
  className?: string;
}

export function TimeAgo({ iso, className }: Props) {
  const absolute = new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <time dateTime={iso} title={absolute} className={className}>
      {formatRelative(iso)}
    </time>
  );
}
