import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the literature review step content: AI banner and the
 * per-sub-box article cards in the single-column grid.
 *
 * @returns The literature review loading skeleton.
 */
export function LiteratureReviewSkeleton() {
  return (
    <div className="w-full space-y-8">
      <div className="flex w-full items-start gap-3 rounded-md border border-primary/20 bg-primary/10 px-4 py-3">
        <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-full bg-border/20" />
          <Skeleton className="h-3 w-4/5 bg-border/20" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="space-y-4 rounded-md p-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-1.5 rounded-full bg-border/20" />
              <Skeleton className="h-7 w-56" />
              <Skeleton className="ml-auto h-5 w-24 rounded-md bg-border/20" />
            </div>
            <Skeleton className="h-3 w-full bg-border/20" />
            <Skeleton className="h-3 w-3/4 bg-border/20" />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, cardIndex) => (
                <div
                  key={cardIndex}
                  className="space-y-2 rounded-md border border-border bg-card p-3.5"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3 w-1/3 bg-border/20" />
                  </div>
                  <Skeleton className="h-3 w-full bg-border/20" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
