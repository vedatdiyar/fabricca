import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the onboarding boxes step content: AI banner, the topic
 * box card grid, and the proceed button row.
 *
 * @returns The boxes step loading skeleton.
 */
export function BoxesSkeleton() {
  return (
    <div className="w-full space-y-6">
      <div className="flex w-full items-start gap-3 rounded-md border border-primary/20 bg-primary/10 px-4 py-3">
        <Skeleton className="mt-1 size-4 shrink-0 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-full bg-border/20" />
          <Skeleton className="h-3 w-4/5 bg-border/20" />
        </div>
      </div>

      <div className="grid auto-rows-min grid-cols-1 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card
            key={`box-card-skel-${index}`}
            className="flex flex-col p-4 sm:p-5 rounded-md border border-border bg-card space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded bg-border/20" />
                <Skeleton className="h-3 w-14 bg-border/20" />
              </div>
              <Skeleton className="h-5 w-28 rounded-md bg-border/20" />
            </div>

            <div className="space-y-1.5">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3.5 w-full bg-border/20" />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {Array.from({ length: 3 }).map((_, conceptIndex) => (
                <Skeleton
                  key={`box-concept-skel-${conceptIndex}`}
                  className="h-4 w-16 rounded bg-border/20"
                />
              ))}
            </div>

            <div className="pt-3 border-t border-border/40 space-y-2">
              <Skeleton className="h-2.5 w-24 bg-border/20" />
              <div className="grid grid-cols-1 gap-2">
                {Array.from({ length: 2 }).map((_, subIndex) => (
                  <div
                    key={`box-sub-skel-${subIndex}`}
                    className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-1.5"
                  >
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3 w-4/5 bg-border/20" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-end pb-8">
        <Skeleton className="h-10 w-52 rounded-md" />
      </div>
    </div>
  );
}

