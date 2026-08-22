import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Loading skeleton for the Thesis Matrix architecture page.
 *
 * @returns 4-column thesis matrix skeleton.
 */
export default function ThesisMatrixLoading() {
  return (
    <div className="w-full space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-[500px] max-w-full bg-border/20" />
        </div>
      </div>

      {/* 4-column Matrix Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`matrix-col-skel-${index}`} className="p-5 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-44 bg-border/20" />
            </div>
            <Skeleton className="h-36 w-full rounded-md bg-border/20" />
          </Card>
        ))}
      </div>
    </div>
  );
}
