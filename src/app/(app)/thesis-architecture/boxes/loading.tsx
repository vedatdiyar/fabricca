import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Loading skeleton for the Topic Boxes architecture page.
 *
 * @returns Subject boxes grid skeleton.
 */
export default function ThesisBoxesLoading() {
  return (
    <div className="w-full space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-[500px] max-w-full bg-border/20" />
        </div>
      </div>

      {/* Boxes Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={`box-card-skel-${index}`} className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-5 w-16 rounded-full bg-border/20" />
            </div>
            <Skeleton className="h-16 w-full bg-border/20" />
            <div className="flex gap-2 pt-2 border-t border-border">
              <Skeleton className="h-4 w-20 bg-border/20" />
              <Skeleton className="h-4 w-20 bg-border/20" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
