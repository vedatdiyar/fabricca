import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Loading skeleton for the Literature Matrix workspace page.
 *
 * @returns Literature matrix table and metrics skeleton.
 */
export default function LiteratureMatrixLoading() {
  return (
    <div className="w-full space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full bg-border/20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`matrix-stat-skel-${index}`} className="p-4 space-y-2">
            <Skeleton className="h-3.5 w-20 bg-border/20" />
            <Skeleton className="h-7 w-16" />
          </Card>
        ))}
      </div>

      {/* Toolbar Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-64 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>

      {/* Table Skeleton */}
      <Card className="overflow-hidden border border-border">
        <div className="border-b border-border bg-muted/40 p-4">
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={`th-skel-${idx}`} className="h-4 w-full" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border p-2">
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <div
              key={`tr-skel-${rowIdx}`}
              className="grid grid-cols-6 gap-4 p-3"
            >
              {Array.from({ length: 6 }).map((_, colIdx) => (
                <Skeleton
                  key={`td-skel-${rowIdx}-${colIdx}`}
                  className="h-4 w-full bg-border/20"
                />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
