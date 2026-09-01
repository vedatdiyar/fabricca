"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  className?: string;
  variant?: "default" | "dashed" | "dashedMuted";
  layout?: "card" | "centered";
  iconWrapperClassName?: string;
  iconClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

/**
 * Merkezi empty-state bileşeni — tüm `border-dashed p-12` ve centered
 * empty-state kopyalarını tek kaynaktan yönetir.
 *
 * @param props - Bileşen prop'ları.
 * @returns Empty state markup.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
  variant = "dashed",
  layout = "card",
  iconWrapperClassName,
  iconClassName,
  titleClassName,
  descriptionClassName,
}: EmptyStateProps) {
  const content = (
    <>
      {Icon && (
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 border border-border/50 text-muted-foreground mb-4",
            iconWrapperClassName,
          )}
        >
          <Icon className={cn("h-6 w-6", iconClassName)} />
        </div>
      )}
      <h3
        className={cn(
          "font-serif text-base font-semibold tracking-tight text-foreground",
          titleClassName,
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2.5 mt-5">
          {actions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <Button
                key={action.label}
                variant={action.variant ?? "default"}
                size="sm"
                onClick={action.onClick}
                className="gap-1.5 text-xs h-8"
              >
                {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
                {action.label}
              </Button>
            );
          })}
        </div>
      )}
    </>
  );

  if (layout === "centered") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-6 text-center",
          className,
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <Card
      variant={variant}
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center",
        className,
      )}
    >
      {content}
    </Card>
  );
}
