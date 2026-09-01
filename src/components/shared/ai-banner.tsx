"use client";

import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface AIBannerProps {
  variant?: "info" | "success" | "warning";
  icon?: LucideIcon;
  title: string;
  description: string;
}

const iconColors: Record<string, string> = {
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
};

/**
 * Central AI informational banner used on onboarding pages to inform the user about AI operations.
 *
 * @param root0 - Component props.
 * @param root0.variant - Visual style variant of the banner.
 * @param root0.icon - Optional icon rendered at the start of the banner.
 * @param root0.title - Bold title text of the banner.
 * @param root0.description - Supporting description text of the banner.
 * @returns The banner markup.
 */
export function AIBanner({
  variant = "info",
  icon: Icon = Sparkles,
  title,
  description,
}: AIBannerProps) {
  return (
    <Alert
      variant={variant}
      className="px-4 py-3 w-full animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColors[variant])} />
      <div className="space-y-2">
        <AlertTitle className="text-sm font-semibold text-foreground">
          {title}
        </AlertTitle>
        <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </AlertDescription>
      </div>
    </Alert>
  );
}
