"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface AIBannerSkeletonProps {
  className?: string;
  lines?: number;
}

/**
 * Skeleton mirroring the AI banner (`border-primary/20 bg-primary/10 px-4 py-3`),
 * used across onboarding skeleton screens.
 *
 * @param props - Component props.
 * @returns Banner skeleton markup.
 */
export function AIBannerSkeleton({
  className,
  lines = 2,
}: AIBannerSkeletonProps) {
  return (
    <div
      className={cn(
        "flex w-full items-start gap-3 rounded-md border border-primary/20 bg-primary/10 px-4 py-3",
        className,
      )}
    >
      <Skeleton className="mt-1 size-4 shrink-0 rounded-md" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-64" />
        {Array.from({ length: lines }).map((_, idx) => (
          <Skeleton
            key={`ai-banner-line-${idx}`}
            className={cn(
              "h-3 bg-border/20",
              idx === lines - 1 ? "w-4/10" : "w-full",
            )}
          />
        ))}
      </div>
    </div>
  );
}
