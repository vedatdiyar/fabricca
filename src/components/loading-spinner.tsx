"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  variant?: "card" | "full";
  message?: string;
}

/** Central loading component with card or full-page variants for all async loading states. */
export function LoadingSpinner({
  variant = "card",
  message,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        variant === "full" ? "min-h-[60vh]" : "min-h-[40vh]",
      )}
    >
      {message ? (
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">{message}</p>
        </div>
      ) : (
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      )}
    </div>
  );
}
