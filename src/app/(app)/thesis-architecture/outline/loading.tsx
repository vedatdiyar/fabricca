import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Loading skeleton for the Thesis Outline architecture page.
 *
 * @returns Outline section hierarchy skeleton.
 */
export default function ThesisOutlineLoading() {
  return (
    <div className="w-full space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-[500px] max-w-full bg-border/20" />
        </div>
      </div>

      {/* Sections Outline List Skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, parentIdx) => (
          <Card
            key={`outline-parent-skel-${parentIdx}`}
            className="p-5 space-y-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-8 rounded-md bg-border/20" />
              <Skeleton className="h-6 w-64" />
            </div>
            <div className="pl-11 space-y-2">
              {Array.from({ length: 2 }).map((_, childIdx) => (
                <div
                  key={`outline-child-skel-${parentIdx}-${childIdx}`}
                  className="flex items-center gap-3 p-2 rounded-md bg-muted/30"
                >
                  <Skeleton className="h-4 w-6 rounded bg-border/20" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
