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
      {/* Top Bar Skeleton */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/60">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>

      {/* 2x2 Pillars Grid Skeleton */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={`box-card-skel-${index}`}
            className="p-5 space-y-4 border-border bg-card/60"
          >
            <div className="space-y-2 pb-3.5 border-b border-border/40">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg bg-border/20" />
              <Skeleton className="h-20 w-full rounded-lg bg-border/20" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
