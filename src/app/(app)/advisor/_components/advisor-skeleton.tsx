import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Skeleton mirroring the advisor page layout: session sidebar and the chat
 * message list with its composer input.
 *
 * @returns The advisor loading skeleton.
 */
export function AdvisorSkeleton() {
  return (
    <div className="flex w-full min-h-0 gap-6 h-[calc(100vh-8.5rem)]">
      <div className="hidden h-full w-80 min-h-0 shrink-0 flex-col lg:flex">
        <Card className="flex h-full w-full min-h-0 flex-col space-y-3.5 rounded-md p-4 border-border">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-md bg-border/40" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-24 bg-border/40" />
                <Skeleton className="h-2.5 w-32 bg-border/20" />
              </div>
            </div>
            <Skeleton className="h-6 w-6 rounded-md bg-border/20" />
          </div>

          {/* New Chat Button Skeleton */}
          <Skeleton className="h-8 w-full rounded-md bg-border/30 shrink-0" />

          {/* Search Skeleton */}
          <Skeleton className="h-8 w-full rounded-md bg-border/30 shrink-0" />

          {/* Session List Skeleton */}
          <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`advisor-session-skel-${index}`}
                className="space-y-2 rounded-md border border-border/40 bg-card p-3"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-3.5 rounded-xs bg-border/30" />
                  <Skeleton className="h-3 w-4/5 bg-border/40" />
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/20">
                  <Skeleton className="h-2.5 w-12 bg-border/20" />
                  <Skeleton className="h-2.5 w-16 bg-border/20" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 px-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={`advisor-msg-skel-${index}`}
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
