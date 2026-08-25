import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the citation cards page layout: header, interactive filter pills,
 * sidebar, toolbar, and the citation card grid.
 *
 * @returns The citation cards loading skeleton.
 */
export function CitationCardsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      {/* Main Layout Skeleton */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Left Sidebar Skeleton */}
        <Card className="w-full lg:w-96 shrink-0 flex flex-col gap-3 rounded-md p-4 border-border">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-md bg-border/40" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36 bg-border/40" />
              </div>
            </div>
            <Skeleton className="h-5 w-12 rounded bg-border/40" />
          </div>
          <Skeleton className="h-8 w-full rounded-md bg-border/40 my-1" />
          <div className="flex gap-1 mb-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={`cite-tab-skel-${index}`}
                className="h-6 w-full rounded bg-border/40"
              />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={`cite-side-skel-${index}`}
                className="h-12 w-full rounded-md bg-border/40"
              />
            ))}
          </div>
        </Card>

        {/* Right Main Area Skeleton */}
        <div className="flex min-w-0 w-full flex-1 flex-col gap-4">
          <Card className="flex flex-col gap-3 rounded-md p-3.5 border-border">
            {/* Search & Actions Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <Skeleton className="h-9 w-full sm:w-72 rounded-md bg-border/40" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-36 rounded-md bg-border/40" />
                <Skeleton className="h-9 w-24 rounded-md" />
              </div>
            </div>
            {/* Pills Row */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton
                  key={`cite-pill-skel-${index}`}
                  className="h-7 w-28 rounded-md bg-border/40"
                />
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card
                key={`cite-card-skel-${index}`}
                className="space-y-3 rounded-md p-4 border-border"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/40">
                  <Skeleton className="h-5 w-24 rounded bg-border/40" />
                  <Skeleton className="h-5 w-16 rounded bg-border/40" />
                </div>
                <Skeleton className="h-16 w-full rounded bg-border/40" />
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <Skeleton className="h-4 w-32 bg-border/40" />
                  <Skeleton className="h-5 w-12 rounded bg-border/40" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
