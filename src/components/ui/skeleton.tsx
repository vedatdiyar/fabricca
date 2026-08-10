import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Base pulsing placeholder block used to compose page-specific loading skeletons.
 *
 * @param root0 - Component props.
 * @param root0.className - Sizing, spacing, and shaping classes for the block.
 * @returns The pulse-animated placeholder element.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse rounded-md bg-border/40", className)} />
  );
}
