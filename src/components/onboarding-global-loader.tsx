"use client";

import { Sparkles } from "lucide-react";
import { useOnboardingStore } from "@/lib/store/onboarding-store";

/**
 * Global onboarding loading overlay.
 * Renders a full-screen loading panel when onboarding store indicates processing.
 * Design preserves the original OnboardingRiskLoading theme: animated spinner,
 * Sparkles icon, step indicators with active/completed/idle states.
 */
export function OnboardingGlobalLoader() {
  const { isLoading, loadingTitle, loadingDescription, loadingSteps } =
    useOnboardingStore();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
      <div className="flex flex-col items-center justify-center space-y-8 max-w-md mx-auto text-center px-6">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <Sparkles className="w-6 h-6 text-primary absolute animate-pulse" />
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            {loadingTitle}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {loadingDescription}
          </p>
        </div>

        <div className="w-full bg-muted border border-border rounded-lg p-5 text-left space-y-4">
          {loadingSteps.map((step, index) => {
            const isActive = step.status === "active";
            const isCompleted = step.status === "completed";
            return (
              <div
                key={index}
                className={`flex items-center gap-3 text-sm ${
                  isActive || isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isActive
                      ? "bg-primary animate-ping"
                      : isCompleted
                        ? "bg-primary"
                        : "bg-border"
                  }`}
                />
                <span className={isActive ? "font-medium" : ""}>
                  {step.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
