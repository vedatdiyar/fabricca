"use client";

import { AlertTriangle, WifiOff, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getErrorDisplay,
  type ErrorDisplay as ErrorDisplayType,
} from "@/lib/error-utils";

interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
}

const SCENARIO_CONFIG: Record<
  ErrorDisplayType["scenario"],
  {
    Icon: typeof AlertTriangle;
    containerBorder: string;
    iconBorder: string;
    iconColor: string;
    buttonVariant: "default" | "outline" | "secondary";
  }
> = {
  quota: {
    Icon: Clock,
    containerBorder: "border-warning/20 bg-warning/10",
    iconBorder: "border-warning/20",
    iconColor: "text-warning",
    buttonVariant: "secondary",
  },
  network: {
    Icon: WifiOff,
    containerBorder: "border-info/20 bg-info/10",
    iconBorder: "border-info/20",
    iconColor: "text-info",
    buttonVariant: "outline",
  },
  system: {
    Icon: AlertTriangle,
    containerBorder: "border-destructive/20 bg-destructive/10",
    iconBorder: "border-destructive/20",
    iconColor: "text-destructive",
    buttonVariant: "default",
  },
};

/** Global error masking component: classifies an error and renders a safe title + description; the original error never leaks to the screen. */
export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const display = getErrorDisplay(error);
  const config = SCENARIO_CONFIG[display.scenario];
  const { Icon } = config;

  return (
    <main className="error-display-container">
      <div className="error-display-content">
        <div className={`error-display-icon-wrapper ${config.containerBorder}`}>
          <Icon className={`w-6 h-6 ${config.iconColor}`} />
        </div>

        <div className="space-y-2">
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            {display.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {display.description}
          </p>
        </div>

        {display.canRetry && onRetry && (
          <Button
            onClick={onRetry}
            variant={config.buttonVariant}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4 animate-spin-hover" />
            Yeniden Dene
          </Button>
        )}
      </div>
    </main>
  );
}
