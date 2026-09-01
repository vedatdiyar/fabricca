"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  iconSizeClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  subtextClassName?: string;
  topSlot?: React.ReactNode;
  className?: string;
  cardClassName?: string;
}

/**
 * Single metric card: left text column (label/value/subtext + optional top slot)
 * and right icon box. Preserves exact `CardContent flex items-center justify-between p-3`
 * skeleton so pixel parity is maintained across all metrics strips.
 *
 * @param props - Metric card props.
 * @returns Metric card markup.
 */
export function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  iconClassName = "border-primary/20 bg-primary/10 text-primary",
  iconSizeClassName = "size-3.5",
  labelClassName = "text-xs font-medium text-muted-foreground truncate",
  valueClassName = "font-mono text-xs font-semibold tracking-tight text-foreground",
  subtextClassName = "text-xs text-muted-foreground truncate",
  topSlot,
  className,
  cardClassName,
}: MetricCardProps) {
  return (
    <Card
      className={cn("border border-border bg-card", cardClassName)}
    >
      <CardContent
        className={cn("flex items-center justify-between p-3", className)}
      >
        <div className="space-y-0.5 min-w-0 flex-1">
          {topSlot ? <div className="flex items-center gap-1.5">{topSlot}</div> : null}
          <p className={labelClassName}>{label}</p>
          <p className={valueClassName}>{value}</p>
          {subtext !== undefined && subtext !== null && subtext !== "" ? (
            <p className={subtextClassName}>{subtext}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
            iconClassName,
          )}
        >
          <Icon className={iconSizeClassName} />
        </div>
      </CardContent>
    </Card>
  );
}
