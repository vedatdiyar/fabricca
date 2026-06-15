"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import type { OnboardingStep } from "@/lib/types";

interface StepDef {
  key: OnboardingStep;
  label: string;
  route: string;
}

const STEPS: StepDef[] = [
  { key: "matrix", label: "Tez Matrisi", route: "/onboarding/matrix" },
  {
    key: "enrichment",
    label: "Matris Zenginleştirme",
    route: "/onboarding/enrichment",
  },
  { key: "risk", label: "Özgünlük & Risk", route: "/onboarding/risk" },
  { key: "boxes", label: "Konu Kutuları", route: "/onboarding/boxes" },
  {
    key: "literature-review",
    label: "Literatür Tarama",
    route: "/onboarding/literature-review",
  },
];

export function OnboardingStepper() {
  const router = useRouter();
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const status = useOnboardingStore((s) => s.status);
  const setStep = useOnboardingStore((s) => s.setStep);

  const handleStepClick = useCallback(
    (step: StepDef) => {
      if (step.key === currentStep) return;
      const stepStatus = status[step.key as keyof typeof status];
      if (!stepStatus || stepStatus === "idle" || stepStatus === "loading")
        return;
      setStep(step.key);
      router.push(step.route);
    },
    [currentStep, status, setStep, router],
  );

  const getStepStatus = useCallback(
    (step: StepDef) => {
      return status[step.key as keyof typeof status] ?? "idle";
    },
    [status],
  );

  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  const progressHeight =
    currentIdx > 0
      ? `${(currentIdx / (STEPS.length - 1)) * 100}%`
      : "0%";

  return (
    <nav
      className="sticky top-0 z-50 h-screen w-14 md:w-56 shrink-0 border-r border-border bg-background/80 backdrop-blur-md overflow-y-auto"
      aria-label="Onboarding adım navigasyonu"
    >
      <div className="relative flex flex-col justify-center h-full">
        {/* ── ARKA PLAN ÇİZGİSİ (RAY) ── */}
        <div
          className="absolute left-[1.75rem] top-0 w-[1px] h-full bg-border/20"
          aria-hidden="true"
        >
          <div
            className="w-full bg-primary/20 transition-all duration-500 ease-in-out"
            style={{ height: progressHeight }}
          />
        </div>

        {/* ── ADIM ELEMANLARI ── */}
        {STEPS.map((step, index) => {
          const stepStatus = getStepStatus(step);
          const isActive = currentStep === step.key;
          const isCompleted = stepStatus === "success" && !isActive;
          const isClickable = stepStatus === "success" && !isActive;
          const isError = stepStatus === "error";

          return (
            <div
              key={step.key}
              className="relative flex items-center w-full pl-3.5"
            >
              <button
                type="button"
                onClick={() => handleStepClick(step)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-4 w-full py-3 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                  isClickable &&
                    "cursor-pointer text-muted-foreground hover:text-foreground",
                  isActive && "text-primary font-medium",
                  !isClickable &&
                    !isActive &&
                    "text-muted-foreground cursor-default",
                )}
                tabIndex={isClickable ? 0 : -1}
                aria-current={isActive ? "step" : undefined}
              >
                {/* Sayı / İkon Dairesi */}
                <span
                  className={cn(
                    "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all border bg-background shadow-sm",
                    isActive &&
                      "bg-primary text-primary-foreground border-primary scale-110 shadow-primary/10 ring-4 ring-primary/10",
                    isCompleted &&
                      "border-primary/20 text-primary bg-primary/5 shadow-sm",
                    isError &&
                      "bg-destructive/10 border-destructive/20 text-destructive",
                    !isActive &&
                      !isCompleted &&
                      !isError &&
                      "border-border text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check
                      className="h-3.5 w-3.5 stroke-[3]"
                      aria-hidden="true"
                    />
                  ) : isError ? (
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>

                {/* Adım Metni */}
                <span
                  className={cn(
                    "hidden md:block text-[11px] tracking-wider uppercase font-medium select-none transition-colors",
                    isActive && "text-foreground font-semibold",
                    isCompleted && "text-muted-foreground font-medium",
                    isError && "text-destructive font-medium",
                    !isActive &&
                      !isCompleted &&
                      !isError &&
                      "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
