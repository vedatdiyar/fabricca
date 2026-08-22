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
    <div className="w-full space-y-6">
      <div className="flex w-full items-start gap-3 rounded-md border border-primary/20 bg-primary/10 px-4 py-3">
        <Skeleton className="mt-1 size-4 shrink-0 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-full bg-border/20" />
          <Skeleton className="h-3 w-4/5 bg-border/20" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card
            key={`lit-rev-skel-${index}`}
            className="flex flex-col p-5 sm:p-6 rounded-md border border-border bg-card space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded bg-primary/10" />
                <Skeleton className="h-3.5 w-16" />
              </div>
              <Skeleton className="h-5 w-24 rounded-md bg-border/20" />
            </div>

            <div className="space-y-1.5">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full bg-border/20" />
            </div>

            <div className="pt-3 border-t border-border/40 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {Array.from({ length: 2 }).map((_, cardIndex) => (
                  <div
                    key={`lit-rev-card-skel-${cardIndex}`}
                    className="rounded-md border border-border/40 bg-card/60 p-4 space-y-2"
                  >
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3.5 w-1/2 bg-border/20" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

