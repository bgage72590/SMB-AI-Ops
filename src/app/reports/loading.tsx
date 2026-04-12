import { StatCardSkeleton } from "@/components/Skeleton";
import { CardSkeleton } from "@/components/Skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="animate-pulse rounded-md bg-surface-2 h-3 w-16" />
        <div className="animate-pulse rounded-md bg-surface-2 h-8 w-40" />
        <div className="animate-pulse rounded-md bg-surface-2 h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <CardSkeleton />
    </div>
  );
}
