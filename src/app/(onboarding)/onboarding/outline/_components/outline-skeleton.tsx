import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the outline step content: the hierarchical outline tree
 * with nested sections in bordered cards.
 *
 * @returns The outline step loading skeleton.
 */
export function OutlineSkeleton() {
  return (
    <div className="w-full flex flex-col gap-1">
      {Array.from({ length: 4 }).map((_, sectionIdx) => (
        <div
          key={sectionIdx}
          className="rounded-lg border border-border/60 bg-card/40 p-4 mb-4"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>

          {sectionIdx < 2 && (
            <div className="ml-6 mt-3 pl-4 border-l-2 border-primary/20 flex flex-col gap-2.5">
              {Array.from({ length: 2 }).map((_, subIdx) => (
                <div key={subIdx} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-10 rounded shrink-0" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-end pt-4 pb-8">
        <Skeleton className="h-10 w-52 rounded-md" />
      </div>
    </div>
  );
}
