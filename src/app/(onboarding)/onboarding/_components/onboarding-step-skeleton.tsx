import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface OnboardingStepSkeletonProps {
  children?: React.ReactNode;
}

/**
 * Skeleton mirroring the shared onboarding step page shell: centered
 * max-w-5xl wrapper, header row with title and start-over button, followed by
 * the step-specific content placeholder.
 *
 * @param root0 - Component props.
 * @param root0.children - Optional step-specific content skeleton; defaults to a form-like card block.
 * @returns The onboarding step loading skeleton.
 */
export function OnboardingStepSkeleton({
  children,
}: OnboardingStepSkeletonProps) {
  return (
    <div className="flex flex-col items-center justify-center p-4 pt-10 pb-4">
      <div className="flex w-full max-w-5xl flex-col items-center space-y-4">
        <div className="flex w-full flex-col items-start justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
          <div className="flex w-full max-w-xl flex-col space-y-2 text-left">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80 max-w-full bg-border/20" />
          </div>
          <div className="flex items-center self-end sm:self-center">
            <Skeleton className="h-9 w-28 rounded-md bg-border/20" />
          </div>
        </div>

        {children ?? (
          <Card className="w-full space-y-5 rounded-md p-6">
            {Array.from({ length: 2 }).map((_, sectionIndex) => (
              <div
                key={`onboarding-step-skel-${sectionIndex}`}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-md bg-border/20" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-3 w-1/2 bg-border/20" />
                <Skeleton className="h-20 w-full rounded-md bg-border/20" />
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Skeleton className="h-10 w-40 rounded-md" />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
