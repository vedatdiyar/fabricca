"use client";

import { usePathname, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "matrix", label: "Tez Matrisi", route: "/onboarding/matrix" },
  { key: "enrichment", label: "Matris Zenginleştirme", route: "/onboarding/enrichment" },
  { key: "risk", label: "Özgünlük & Risk", route: "/onboarding/risk" },
  { key: "boxes", label: "Konu Kutuları", route: "/onboarding/boxes" },
  { key: "literature-review", label: "Literatür Tarama", route: "/onboarding/literature-review" },
];

export function OnboardingStepper() {
  const pathname = usePathname();
  const router = useRouter();

  const currentIdx = STEPS.findIndex((s) => s.route === pathname);

  const progressHeight = currentIdx > 0 ? `${(currentIdx / (STEPS.length - 1)) * 100}%` : "0%";

  return (
    <nav
      className="sticky top-0 z-50 h-screen w-14 md:w-56 shrink-0 border-r border-border bg-background/80 backdrop-blur-md overflow-y-auto"
      aria-label="Onboarding adım navigasyonu"
    >
      <div className="relative flex flex-col justify-center h-full">
        <div className="absolute left-[1.75rem] top-0 w-[1px] h-full bg-border/20" aria-hidden="true">
          <div className="w-full bg-primary/20 transition-all duration-500 ease-in-out" style={{ height: progressHeight }} />
        </div>

        {STEPS.map((step, index) => {
          const isActive = currentIdx === index;
          const isCompleted = currentIdx > index;

          return (
            <div key={step.key} className="relative flex items-center w-full pl-3.5">
              <button
                type="button"
                onClick={() => router.push(step.route)}
                className={cn(
                  "flex items-center gap-4 w-full py-3 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-pointer hover:text-foreground",
                  isActive && "text-primary font-medium",
                  !isActive && "text-muted-foreground",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={cn(
                    "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all border bg-background shadow-sm",
                    isActive && "bg-primary text-primary-foreground border-primary scale-110 ring-4 ring-primary/10",
                    isCompleted && "border-primary/20 text-primary bg-primary/5 shadow-sm",
                    !isActive && !isCompleted && "border-border text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "hidden md:block text-[11px] tracking-wider uppercase font-medium select-none transition-colors",
                    isActive && "text-foreground font-semibold",
                    isCompleted && "text-muted-foreground font-medium",
                    !isActive && !isCompleted && "text-muted-foreground",
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
