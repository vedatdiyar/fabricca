"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLoadingOverlay } from "@/core/providers/loading-overlay-provider";

/**
 * Global onboarding loading screen rendered inside the blur overlay, using a segmented
 * progress bar mapped exactly to the length of the `loadingSteps` array so each step
 * transitions rhythmically for the user to catch green checkmarks and the active step
 * shows a "Thinking Mode" indicator sub-text instead of an infinite spinner.
 *
 * @returns The global loading screen markup.
 */
export function OnboardingGlobalLoader() {
  const {
    loadingTitle,
    loadingDescription,
    loadingSteps,
    hasCancel,
    cancelLoading,
  } = useLoadingOverlay();

  return (
    <div className="flex flex-col items-center justify-center space-y-10 text-center px-6 w-full">
      <div className="space-y-3">
        <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
          {loadingTitle}
        </h2>
        <p className="text-sm font-normal text-muted-foreground leading-relaxed max-w-lg mx-auto">
          {loadingDescription}
        </p>
      </div>

      <Card className="w-full p-4 rounded-md">
        <div className="flex flex-wrap items-start justify-center gap-y-6 gap-x-6 w-full">
          {loadingSteps.map((step, index) => {
            const isActive = step.status === "active";
            const isCompleted = step.status === "completed";
            return (
              <div
                key={`${step.text}-${index}`}
                className="flex-1 min-w-35 max-w-50 flex flex-col items-center gap-3"
              >
                <div className="w-full h-2 rounded-full bg-border/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      isCompleted
                        ? "w-full bg-primary"
                        : isActive
                          ? "w-full bg-gradient-to-r from-primary via-primary/60 to-primary animate-pulse"
                          : "w-0"
                    }`}
                  />
                </div>
                <span
                  className={`text-xs leading-tight text-center w-full transition-colors duration-300 ${
                    isCompleted
                      ? "text-primary font-medium"
                      : isActive
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                  }`}
                >
                  {step.text}
                </span>
                {isCompleted && (
                  <span className="text-primary">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {hasCancel && (
        <Button
          variant="destructive"
          onClick={cancelLoading}
          className="w-full sm:w-auto"
        >
          {"\u0130ptal Et"}
        </Button>
      )}
    </div>
  );
}
