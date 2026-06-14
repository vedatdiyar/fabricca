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

  return (
    <nav
      className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md"
      aria-label="Onboarding adım navigasyonu"
    >
      <div className="mx-auto max-w-5xl px-6 py-5">
        <div className="relative flex w-full justify-between items-start">
          {/* ── ARKA PLAN ÇİZGİSİ (RAY SİSTEMİ) ── */}
          <div
            className="absolute left-0 top-3.5 hidden h-[1px] w-full bg-border/60 md:block"
            aria-hidden="true"
          >
            <div
              className="h-full bg-primary/50 transition-all duration-500 ease-in-out"
              style={{ width: `${(currentIdx / (STEPS.length - 1)) * 100}%` }}
            />
          </div>

          {/* ── ADIM ELEMANLARI ── */}
          {STEPS.map((step, index) => {
            const stepStatus = getStepStatus(step);
            const isActive = currentStep === step.key;
            const isCompleted = stepStatus === "success" && !isActive;
            const isClickable =
              stepStatus !== "idle" && stepStatus !== "loading" && !isActive;
            const isError = stepStatus === "error";

            return (
              <div
                key={step.key}
                className="relative flex flex-col items-center flex-1"
              >
                {/* Adım Butonu */}
                <button
                  type="button"
                  onClick={() => handleStepClick(step)}
                  disabled={!isClickable}
                  className={cn(
                    "group flex flex-col items-center gap-2.5 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 p-1",
                    isClickable &&
                      "cursor-pointer text-muted-foreground hover:text-foreground",
                    isActive && "text-primary font-medium",
                    !isClickable &&
                      !isActive &&
                      "text-muted-foreground/40 cursor-default",
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
                        "border-primary/50 text-primary bg-primary/5 shadow-sm",
                      isError &&
                        "bg-destructive/10 border-destructive/30 text-destructive",
                      !isActive &&
                        !isCompleted &&
                        !isError &&
                        "border-border text-muted-foreground/60",
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
                      "hidden md:block text-[11px] tracking-wider uppercase font-medium whitespace-nowrap text-center select-none max-w-[120px] transition-colors",
                      isActive && "text-foreground font-semibold",
                      isCompleted && "text-muted-foreground/80 font-medium",
                      isError && "text-destructive font-medium",
                      !isActive &&
                        !isCompleted &&
                        !isError &&
                        "text-muted-foreground/40",
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
