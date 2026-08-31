import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the redesigned dashboard page layout: page header,
 * 4 metric cards, topic boxes grid, divider, and the 3-column Kanban board.
 *
 * @returns The dashboard loading skeleton.
 */
export function DashboardSkeleton() {
  return (
    <div className="w-full space-y-8">
      {/* 4 Metric Cards Skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={`dash-metric-skel-${index}`}
            className="border border-border bg-card"
          >
            <CardContent className="flex items-center justify-between p-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-3 w-20 bg-border/20" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-2.5 w-24 bg-border/20" />
              </div>
              <Skeleton className="h-8 w-8 shrink-0 rounded-md bg-border/20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Topic Boxes Section Skeleton */}
      <section className="space-y-6">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/60">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-3.5 w-96 max-w-full bg-border/20" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card
              key={`dash-box-skel-${index}`}
              className="flex h-full flex-col rounded-md border border-border bg-card"
            >
              <CardHeader className="p-5 pb-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-5 w-24 rounded bg-border/20" />
                  <Skeleton className="h-7 w-20 rounded-md bg-border/20" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3.5 w-full bg-border/20" />
                </div>
                <Skeleton className="h-2 w-full rounded-full bg-border/20 mt-2" />
              </CardHeader>
              <CardContent className="flex-1 p-5 pt-0">
                <Separator className="my-3 bg-border/40" />
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-3.5 w-24 bg-border/20" />
                  <Skeleton className="h-4 w-12 rounded-full bg-border/20" />
                </div>
                <div className="space-y-2.5">
                  {Array.from({ length: 3 }).map((_, itemIndex) => (
                    <div
                      key={`dash-subbox-skel-${itemIndex}`}
                      className="flex flex-col justify-between rounded-md border border-border/40 bg-background/40 p-3 space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <Skeleton className="h-4 w-4 shrink-0 rounded-sm bg-border/20 mt-0.5" />
                        <Skeleton className="h-3.5 w-3/4" />
                      </div>
                      <Skeleton className="h-3 w-1/2 ml-6 bg-border/20" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Section Divider */}
      <Separator className="my-8 bg-border/40" />

      {/* Kanban Board Section Skeleton */}
      <section className="space-y-6">
        <div className="flex w-full flex-col items-start justify-between gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-80 max-w-full bg-border/20" />
          </div>
          <Skeleton className="h-8.5 w-36 rounded-md bg-border/20" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, columnIndex) => (
            <div
              key={`dash-col-skel-${columnIndex}`}
              className="flex min-h-[360px] flex-col gap-4 rounded-md border border-border/60 bg-muted/20 p-4"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-md bg-border/20" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-5 w-8 rounded-md bg-border/20" />
              </div>
              <div className="flex flex-1 flex-col gap-3">
                {Array.from({ length: 2 }).map((_, taskIndex) => (
                  <div
                    key={`dash-task-skel-${taskIndex}`}
                    className="rounded-md border border-border/60 bg-card p-3.5 space-y-2.5"
                  >
                    <Skeleton className="h-4 w-1/3 bg-border/20 rounded" />
                    <Skeleton className="h-3.5 w-4/10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
