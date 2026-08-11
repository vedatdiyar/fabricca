import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the updated outline step content: stats bar and section cards.
 *
 * @returns The outline step loading skeleton.
 */
export function OutlineSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6">
      {/* Banner Skeleton */}
      <Skeleton className="h-20 w-full rounded-md" />

      {/* Stats Bar Skeleton */}
      <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32 rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        </div>
      </div>

      {/* Section Cards Skeleton */}
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, sectionIdx) => (
          <div
            key={sectionIdx}
            className="rounded-md border border-border bg-card p-4 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
              <div className="flex gap-1">
                <Skeleton className="size-7 rounded" />
                <Skeleton className="size-7 rounded" />
                <Skeleton className="size-7 rounded" />
              </div>
            </div>

            {sectionIdx < 2 && (
              <div className="ml-3.5 pl-4 border-l-2 border-primary/20 space-y-3">
                {Array.from({ length: 2 }).map((_, subIdx) => (
                  <div
                    key={subIdx}
                    className="rounded-md border border-border/60 bg-muted/40 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-10 rounded" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4 pb-8">
        <Skeleton className="h-10 w-64 rounded-md" />
      </div>
    </div>
  );
}
