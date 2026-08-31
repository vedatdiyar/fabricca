import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Skeleton mirroring the library page layout: sticky sidebar work list on the
 * left and the resource detail panel on the right.
 *
 * @returns The library loading skeleton.
 */
export function LibrarySkeleton() {
  return (
    <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <div className="flex min-h-0 flex-col lg:col-span-4 lg:sticky lg:top-[calc(7rem+1px)] lg:h-[calc(100vh-8.5rem-1px)]">
        <Card className="flex h-full w-full min-h-0 flex-col space-y-4 rounded-md p-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-md bg-border/20" />
              <Skeleton className="h-6 w-28" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-20 rounded-md bg-border/20" />
              <Skeleton className="h-6 w-8 rounded-md bg-border/20" />
            </div>
          </div>

          <Skeleton className="h-9 w-full rounded-md" />

          <div className="grid grid-cols-6 gap-1 rounded-md bg-muted p-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={`lib-tab-skel-${index}`}
                className="h-6 w-full bg-border/20"
              />
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`lib-item-skel-${index}`}
                className="space-y-2 rounded-md border border-border bg-background p-3"
              >
                <Skeleton className="h-3.5 w-4/10" />
                <Skeleton className="h-3 w-1/2 bg-border/20" />
                <Skeleton className="h-4 w-10 rounded-md bg-border/20" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="h-full min-h-0 lg:col-span-8">
        <Card className="flex h-full min-h-[40vh] w-full flex-col space-y-6 rounded-md p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-3.5 w-full bg-border/20" />
              <Skeleton className="h-3.5 w-2/3 bg-border/20" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-md bg-border/20" />
              <Skeleton className="h-8 w-8 rounded-md bg-border/20" />
            </div>
          </div>

          <div className="my-1 border-t border-border/40" />

          <Skeleton className="mb-2 h-3 w-28 bg-border/20" />

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-md bg-border/20" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-5/6" />
                <Skeleton className="h-14 w-full rounded-md bg-border/20" />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-md bg-border/20" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-10 w-full rounded-md bg-border/20" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
