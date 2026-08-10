import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the dashboard page layout: topic box cards grid, divider,
 * and the Kanban board with its three task columns.
 *
 * @returns The dashboard loading skeleton.
 */
export function DashboardSkeleton() {
  return (
    <div className="w-full space-y-8">
      <section className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96 max-w-full bg-border/20" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card
              key={index}
              className="flex h-full flex-col rounded-md border border-border bg-card text-card-foreground"
            >
              <CardHeader className="p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-full bg-border/20" />
                    <Skeleton className="h-3 w-1/2 bg-border/20" />
                  </div>
                  <Skeleton className="h-8 w-8 shrink-0 rounded-md bg-border/20" />
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-4 pt-0">
                <div className="my-3 border-t border-border/40" />
                <Skeleton className="mb-3 h-3 w-24 bg-border/20" />
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, itemIndex) => (
                    <div
                      key={itemIndex}
                      className="flex items-center justify-between gap-3 rounded-md p-2"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-4/5" />
                        <Skeleton className="h-3 w-1/3 bg-border/20" />
                      </div>
                      <Skeleton className="h-6 w-6 rounded-md bg-border/20" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="my-8 border-t border-border/40" />

      <section className="space-y-4">
        <div className="flex w-full flex-col items-start justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80 max-w-full bg-border/20" />
          </div>
          <Skeleton className="h-9 w-36 rounded-md bg-border/20" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, columnIndex) => (
            <div
              key={columnIndex}
              className="flex min-h-80 flex-col gap-4 rounded-md border border-border/40 bg-background/20 p-4"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full bg-border/20" />
                  <Skeleton className="h-5 w-28" />
                </div>
                <Skeleton className="h-5 w-6 rounded-md bg-border/20" />
              </div>
              <div className="flex flex-1 flex-col gap-3 rounded-md border border-dashed border-border/40 bg-secondary/10 px-4 py-6">
                <Skeleton className="h-3 w-2/3 bg-border/20" />
                <Skeleton className="h-3 w-1/2 bg-border/20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
