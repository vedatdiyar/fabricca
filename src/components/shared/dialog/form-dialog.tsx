"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-xl",
  xl: "max-w-2xl",
};

// Special sizes not in the 4-step scale but used by legacy modals
const extraSizeClasses: Record<string, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

export interface FormDialogBadge {
  label: string;
  className?: string;
}

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: FormDialogBadge;
  subtitle?: string;
  titleIcon?: LucideIcon;
  titleClassName?: string;
  descriptionClassName?: string;
  headerClassName?: string;
  size?: DialogSize | "2xl" | "3xl";
  isSaving?: boolean;
  saveLabel?: string;
  saveIcon?: LucideIcon;
  saveVariant?: "default" | "destructive" | "outline";
  cancelLabel?: string;
  cancelVariant?: "ghost" | "outline";
  onSave?: () => void;
  onCancel?: () => void;
  showSeparator?: boolean;
  scrollable?: boolean;
  footerExtra?: React.ReactNode;
  footerLayout?: "spread" | "end";
  footerClassName?: string;
  className?: string;
  children?: React.ReactNode;
  hideFooter?: boolean;
}

/**
 * Shared dialog shell that centralizes Dialog/DialogContent/DialogHeader/DialogFooter
 * markup, badge handling, separator and save/cancel footer actions.
 *
 * State (useState, useConceptTags, submit handlers) stays in the caller.
 *
 * @param props - Dialog props.
 * @returns Dialog shell markup.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  badge,
  subtitle,
  titleIcon: TitleIcon,
  titleClassName,
  descriptionClassName,
  headerClassName,
  size = "xl",
  isSaving = false,
  saveLabel = "Kaydet",
  saveIcon: SaveIcon,
  saveVariant = "default",
  cancelLabel = "İptal",
  cancelVariant,
  onSave,
  onCancel,
  showSeparator = true,
  scrollable = false,
  footerExtra,
  footerLayout = "spread",
  footerClassName,
  className,
  children,
  hideFooter = false,
}: FormDialogProps) {
  const resolvedSizeClass =
    (sizeClasses as Record<string, string>)[size] ??
    extraSizeClasses[size] ??
    sizeClasses.xl;

  const handleCancel = () => {
    if (onCancel) onCancel();
    else onOpenChange(false);
  };

  // Detect if we should apply the scrollable container classes
  const contentExtra =
    scrollable || size === "xl" || size === "2xl" || size === "3xl"
      ? "max-h-[90vh] flex flex-col"
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-6 gap-4 bg-card border-border",
          resolvedSizeClass,
          contentExtra,
          className,
        )}
        // Prevent Radix from swallowing scroll inside scrollable body
      >
        <DialogHeader className={cn("space-y-1 pb-1", headerClassName)}>
          {(badge || subtitle) && (
            <div className="flex items-center gap-2">
              {badge && (
                <Badge
                  variant="outline"
                  className={cn(
                    "border px-2 py-0.5 text-[11px] font-medium",
                    badge.className ?? "border-border bg-secondary text-secondary-foreground",
                  )}
                >
                  {badge.label}
                </Badge>
              )}
              {subtitle && (
                <span className="text-xs text-muted-foreground font-sans">{subtitle}</span>
              )}
            </div>
          )}
          <DialogTitle className={cn("font-serif text-base font-semibold text-foreground flex items-center gap-2", titleClassName)}>
            {TitleIcon && <TitleIcon className="h-4 w-4" />}
            <span>{title}</span>
          </DialogTitle>
          {description && (
            <DialogDescription className={cn("font-sans text-xs text-muted-foreground", descriptionClassName)}>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {showSeparator && <Separator className="bg-border/40" />}

        {children && (
          <div className={cn(scrollable ? "flex-1 overflow-y-auto space-y-4 pr-1" : "space-y-4 py-2", !showSeparator && "pt-0")}>
            {children}
          </div>
        )}

        {!hideFooter && (
          <>
            {showSeparator && <Separator className="bg-border/40" />}
            <DialogFooter
              className={cn(
                footerLayout === "spread"
                  ? "flex items-center justify-between pt-1 sm:justify-between"
                  : "gap-2",
                footerClassName,
              )}
            >
              {footerLayout === "spread" ? (
                <>
                  <Button
                    variant={cancelVariant ?? "ghost"}
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className={cn(
                      "text-xs",
                      (cancelVariant ?? "ghost") === "ghost" &&
                        saveVariant !== "destructive" &&
                        "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {cancelLabel}
                  </Button>
                  <div className="flex items-center gap-2">
                    {footerExtra}
                    {onSave && (
                      <Button
                        variant={saveVariant}
                        size="sm"
                        onClick={onSave}
                        disabled={isSaving}
                        className={cn(
                          "text-xs font-medium gap-1.5",
                          saveVariant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
                        )}
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : SaveIcon ? (
                          <SaveIcon className="h-3.5 w-3.5" />
                        ) : null}
                        <span>{saveLabel}</span>
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Button variant={cancelVariant ?? "outline"} size="sm" onClick={handleCancel} disabled={isSaving}>
                    {cancelLabel}
                  </Button>
                  <div className="flex items-center gap-2">
                    {footerExtra}
                    {onSave && (
                      <Button
                        variant={saveVariant}
                        size="sm"
                        onClick={onSave}
                        disabled={isSaving}
                        className={cn(
                          "font-medium",
                          saveVariant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
                        )}
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : SaveIcon ? (
                          <SaveIcon className="h-3.5 w-3.5 mr-1.5" />
                        ) : null}
                        <span>{saveLabel}</span>
                      </Button>
                    )}
                  </div>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
