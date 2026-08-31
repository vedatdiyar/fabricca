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
}

/**
 * Merkezi empty-state bileşeni — tüm `border-dashed p-12` kopyalarını tek kaynaktan yönetir.
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
}: EmptyStateProps) {
  return (
    <Card
      variant={variant}
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 border border-border/50 text-muted-foreground mb-4">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">
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
    </Card>
  );
}
