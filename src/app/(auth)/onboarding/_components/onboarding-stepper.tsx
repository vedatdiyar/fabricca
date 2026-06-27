"use client";

import { usePathname, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "matrix", label: "Tez Matrisi", route: "/onboarding/matrix" },
  { key: "risk", label: "\u00d6zgünlük & Risk", route: "/onboarding/risk" },
  { key: "boxes", label: "Konu Kutuları", route: "/onboarding/boxes" },
  {
    key: "literature-review",
    label: "Literat\u00fcr Tarama",
    route: "/onboarding/literature-review",
  },
];

export function OnboardingStepper({
  stepsData,
}: {
  stepsData: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const currentIdx = STEPS.findIndex((s) => s.route === pathname);

  return (
    <nav
      className="sticky top-0 z-50 h-screen w-14 md:w-56 shrink-0 border-r border-border bg-background/80 backdrop-blur-md overflow-y-auto"
      aria-label="Onboarding adım navigasyonu"
    >
      <div className="relative flex flex-col justify-center h-full">
        {STEPS.map((step, index) => {
          const isActive = currentIdx === index;
          const isCompleted = currentIdx > index;
          const isFuture = currentIdx < index;
          const hasData = stepsData[step.key] ?? false;
          const isDisabled = isFuture && !hasData;

          return (
            <div
              key={step.key}
              className="relative flex items-center w-full pl-3.5"
            >
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  router.push(step.route);
                }}
                className={cn(
                  "flex items-center gap-4 w-full py-3 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                  !isDisabled && "cursor-pointer hover:text-foreground",
                  isDisabled && "cursor-not-allowed opacity-40",
                  isActive && "text-primary font-medium",
                  !isActive && "text-muted-foreground",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={cn(
                    "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all border bg-background",
                    isActive &&
                      "bg-primary text-primary-foreground border-primary scale-110 ring-4 ring-primary/10",
                    isCompleted &&
                      "border-primary/20 text-primary bg-primary/5",
                    !isActive &&
                      !isCompleted &&
                      "border-border text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check
                      className="h-3.5 w-3.5 stroke-[3]"
                      aria-hidden="true"
                    />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "hidden md:block text-xs tracking-wider uppercase font-medium select-none transition-colors",
                    isActive && "text-foreground font-semibold",
                    isCompleted && "text-foreground font-medium",
                    !isActive && !isCompleted && "text-foreground",
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
