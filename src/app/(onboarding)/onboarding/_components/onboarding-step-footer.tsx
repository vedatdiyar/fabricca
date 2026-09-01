"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingStepFooterProps {
  onBack?: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  backIcon?: LucideIcon;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  nextLoadingText?: string;
  isLastStep?: boolean;
  className?: string;
}

/**
 * Standardized bottom action footer for all onboarding steps, ensuring uniform
 * spacing, border division, button sizes, and primary/secondary button placement.
 *
 * @param props - Component props.
 * @returns The rendered step footer markup.
 */
export function OnboardingStepFooter({
  onBack,
  backLabel = "Önceki Aşama",
  backDisabled = false,
  backIcon: BackIcon = ArrowLeft,
  onNext,
  nextLabel,
  nextDisabled = false,
  nextLoading = false,
  nextLoadingText = "Kaydediliyor...",
  isLastStep = false,
  className,
}: OnboardingStepFooterProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between pt-6 pb-8 border-t border-border/40 mt-6",
        className,
      )}
    >
      {onBack ? (
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={onBack}
          disabled={backDisabled || nextLoading}
        >
          <BackIcon className="size-4" />
          <span>{backLabel}</span>
        </Button>
      ) : (
        <div />
      )}

      <Button
        type="button"
        variant="default"
        size="lg"
        onClick={onNext}
        disabled={nextDisabled || nextLoading}
      >
        {nextLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>{nextLoadingText}</span>
          </>
        ) : (
          <>
            <span>{nextLabel}</span>
            {isLastStep ? (
              <Check className="size-4" />
            ) : (
              <ArrowRight className="size-4" />
            )}
          </>
        )}
      </Button>
    </div>
  );
}
