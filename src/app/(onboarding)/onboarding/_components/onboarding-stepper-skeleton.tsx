import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton mirroring the OnboardingStepper sidebar navigation.
 * Renders the static structural nav shell with 5 placeholder step items
 * to prevent layout shift during streaming transitions.
 *
 * @returns The stepper sidebar loading skeleton.
 */
export function OnboardingStepperSkeleton() {
  return (
    <nav
      className="sticky top-0 z-50 h-screen w-14 shrink-0 overflow-y-auto border-r border-border bg-background/80 backdrop-blur-md md:w-56"
      aria-label="Onboarding adım navigasyonu yükleniyor"
    >
      <div className="relative flex h-full flex-col justify-center">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`stepper-skeleton-${index}`}
            className="relative flex w-full items-center pl-4"
          >
            <div className="flex w-full items-center gap-4 py-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full border border-border bg-border/20" />
              <Skeleton className="hidden h-3.5 w-28 bg-border/20 md:block" />
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
