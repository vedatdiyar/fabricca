"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PillarCardProps {
  badgeLabel: string;
  badgeClassName?: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconWrapperClassName?: string;
  iconClassName?: string;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  variant?: "card" | "muted";
}

/**
 * Generic pillar card shell used by both matrix and quadrant pillars.
 * Preserves exact header layout (badge + title + description + action toolbar)
 * and content/footer slots so consumers stay pixel-identical.
 *
 * @param props - Pillar card props.
 * @returns Pillar card markup.
 */
export function PillarCard({
  badgeLabel,
  badgeClassName,
  title,
  description,
  icon: Icon,
  iconWrapperClassName,
  iconClassName = "size-3.5",
  headerActions,
  footer,
  children,
  className,
  headerClassName,
  contentClassName,
  variant = "card",
}: PillarCardProps) {
  const containerBase =
    variant === "muted"
      ? "flex flex-col h-full rounded-lg border border-border bg-card/60 transition-all hover:border-border/90"
      : "flex flex-col h-full bg-card transition-all border-border hover:border-border/80";

  return (
    <Card className={cn(containerBase, className)}>
      {/* Header */}
      <div
        className={cn(
          "p-4 sm:p-5 pb-3 flex flex-row items-start justify-between gap-3 border-b border-border/40 space-y-0",
          // muted variant uses slightly different header padding/spacing
          variant === "muted" && "pb-3.5 space-y-1.5 flex-col",
          headerClassName,
        )}
      >
        {/* Left: icon + badge + title stack */}
        <div className={cn("flex items-start gap-3 min-w-0 flex-1", variant === "muted" && "flex-col w-full gap-0")}>
          {variant === "muted" ? (
            <>
              <div className="flex items-center justify-between gap-2 w-full">
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium border-border bg-secondary text-secondary-foreground",
                    badgeClassName,
                  )}
                >
                  {badgeLabel}
                </Badge>
                {headerActions ? (
                  <div className="flex items-center gap-1 shrink-0">{headerActions}</div>
                ) : null}
              </div>
              <h2 className="font-serif text-base font-semibold tracking-tight text-foreground leading-snug mt-1.5">
                {title}
              </h2>
              {description ? (
                <p className="font-sans text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </>
          ) : (
            <>
              {Icon ? (
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                    iconWrapperClassName ?? "bg-primary/10 text-primary border-primary/20",
                  )}
                >
                  <Icon className={iconClassName} />
                </div>
              ) : null}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("border", badgeClassName ?? "bg-secondary text-secondary-foreground border-border")}
                  >
                    {badgeLabel}
                  </Badge>
                </div>
                <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">{title}</h3>
                {description ? (
                  <p className="font-sans text-xs text-muted-foreground">{description}</p>
                ) : null}
              </div>
              {headerActions ? (
                <div className="flex items-center gap-1 shrink-0">{headerActions}</div>
              ) : null}
            </>
          )}
        </div>

        {/* For muted variant headerActions already rendered in top row */}
      </div>

      {/* Body */}
      <div className={cn("flex flex-1 flex-col p-4 sm:p-5 pt-4", contentClassName)}>{children}</div>

      {/* Footer */}
      {footer ? (
        <div className="p-4 sm:p-5 pt-0 flex items-center justify-between border-t border-border/40 mt-auto text-xs text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
