"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonGridProps {
  count: number;
  className?: string;
  children: (index: number) => React.ReactNode;
}

/**
 * Thin wrapper around a grid of skeletons. Preserves the underlying
 * `grid` class string passed via `className` for pixel parity.
 *
 * @param props - Component props.
 * @returns Skeleton grid markup.
 */
export function SkeletonGrid({ count, className, children }: SkeletonGridProps) {
  return (
    <div className={cn(className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <React.Fragment key={`skel-${idx}`}>{children(idx)}</React.Fragment>
      ))}
    </div>
  );
}
