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
