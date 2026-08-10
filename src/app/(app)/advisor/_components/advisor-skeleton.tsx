import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the advisor page layout: session sidebar and the chat
 * message list with its composer input.
 *
 * @returns The advisor loading skeleton.
 */
export function AdvisorSkeleton() {
  return (
    <div className="flex w-full min-h-0 gap-6 h-[calc(100vh-8.5rem)]">
      <div className="hidden h-full w-72 min-h-0 shrink-0 flex-col lg:flex">
        <div className="flex h-full w-full min-h-0 flex-col space-y-4 rounded-md border border-border bg-card p-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="space-y-1.5 rounded-md border border-border bg-background p-3"
              >
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-2/3 bg-border/20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 px-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${index % 2 === 1 ? "flex-row-reverse" : ""}`}
            >
              <Skeleton className="h-8 w-8 shrink-0 rounded-full bg-border/20" />
              <div
                className={`max-w-[75%] space-y-2 rounded-md border border-border p-3 ${
                  index % 2 === 1 ? "bg-primary/5" : "bg-card"
                }`}
              >
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3.5 w-64 max-w-full bg-border/20" />
                <Skeleton className="h-3.5 w-48 bg-border/20" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2 border-t border-border/40 p-4">
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-md bg-border/20" />
        </div>
      </div>
    </div>
  );
}
