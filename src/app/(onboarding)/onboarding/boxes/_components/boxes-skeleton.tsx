import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the onboarding boxes step content: AI banner, the topic
 * box card grid, and the proceed button row.
 *
 * @returns The boxes step loading skeleton.
 */
export function BoxesSkeleton() {
  return (
    <div className="w-full space-y-8">
      <div className="flex w-full items-start gap-3 rounded-md border border-primary/20 bg-primary/10 px-4 py-3">
        <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-full bg-border/20" />
          <Skeleton className="h-3 w-4/5 bg-border/20" />
        </div>
      </div>

      <div className="grid auto-rows-min grid-cols-1 gap-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="h-full space-y-4 rounded-md p-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-12 bg-border/20" />
              <Skeleton className="ml-auto h-6 w-24 rounded-md bg-border/20" />
            </div>
            <div className="flex items-start gap-3">
              <Skeleton className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-border/20" />
              <CardTitle className="w-full space-y-2">
                <Skeleton className="h-5 w-3/4" />
              </CardTitle>
            </div>
            <Skeleton className="h-3 w-full bg-border/20" />
            <Skeleton className="h-3 w-2/3 bg-border/20" />
            <div className="border-y border-border py-3">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, conceptIndex) => (
                  <Skeleton
                    key={conceptIndex}
                    className="h-6 w-20 rounded-md bg-border/20"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2 pt-1">
              <Skeleton className="h-3 w-24 bg-border/20" />
              <div className="relative ml-3 space-y-3 border-l border-border/40 pl-4">
                {Array.from({ length: 2 }).map((_, subIndex) => (
                  <div key={subIndex} className="space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/2 bg-border/20" />
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
