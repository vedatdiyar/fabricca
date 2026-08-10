import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the citation cards page layout: metric overview cards,
 * filter sidebar, toolbar, and the citation card grid.
 *
 * @returns The citation cards loading skeleton.
 */
export function CitationCardsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-md border border-border bg-card p-3.5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 bg-border/20" />
              <Skeleton className="h-4 w-4 rounded-md bg-border/20" />
            </div>
            <Skeleton className="h-7 w-10" />
          </div>
        ))}
      </div>

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="flex w-full flex-col gap-3 rounded-md border border-border bg-card p-4 lg:w-64 lg:shrink-0">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-md bg-border/20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1 rounded-md bg-muted p-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-6 w-full bg-border/20" />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-1.5 p-2">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-1/2 bg-border/20" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 w-full flex-1 flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center">
            <Skeleton className="h-9 w-full flex-1 rounded-md sm:max-w-60" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-md bg-border/20" />
              <Skeleton className="h-8 w-24 rounded-md bg-border/20" />
              <Skeleton className="h-8 w-24 rounded-md bg-border/20" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={index}
                className="space-y-3 rounded-md border border-border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3 bg-border/20" />
                  </div>
                  <Skeleton className="h-6 w-6 shrink-0 rounded-md bg-border/20" />
                </div>
                <Skeleton className="h-16 w-full rounded-md bg-border/20" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20 rounded-md bg-border/20" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-md bg-border/20" />
                    <Skeleton className="h-7 w-7 rounded-md bg-border/20" />
                    <Skeleton className="h-7 w-7 rounded-md bg-border/20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
