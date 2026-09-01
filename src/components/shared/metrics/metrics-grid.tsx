"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface MetricsGridProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline-tight";
}

const variantClasses: Record<NonNullable<MetricsGridProps["variant"]>, string> = {
  default: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4",
  // xl breakpoint used by outline-metrics-strip
  "outline-tight": "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
};

/**
 * Responsive grid wrapper for metric cards. Preserves the exact
 * `grid grid-cols-1 gap-3 sm:grid-cols-2 lg/xl:grid-cols-4` class
 * strings for pixel parity.
 *
 * @param props - Grid props.
 * @returns Grid wrapper markup.
 */
export function MetricsGrid({
  children,
  className,
  variant = "default",
}: MetricsGridProps) {
  return <div className={cn(variantClasses[variant], className)}>{children}</div>;
}
