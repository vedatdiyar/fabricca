import { StartOverButton } from "./start-over-button";

interface OnboardingStepHeaderProps {
  title: string;
  description: string;
}

/**
 * Standardized page header component for all onboarding steps, rendering
 * the level-1 page heading, explanatory body text, and the reset action.
 *
 * @param props - Component props containing the step title and description.
 * @returns The rendered step header markup.
 */
export function OnboardingStepHeader({
  title,
  description,
}: OnboardingStepHeaderProps) {
  return (
    <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
      <div className="flex flex-col space-y-1 text-left">
        <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="font-sans text-sm font-normal leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex items-center self-end sm:self-center">
        <StartOverButton />
      </div>
    </div>
  );
}
