import { LoadingSpinner } from "@/components/loading-spinner";

/**
 * Loading boundary fallback component for the positioning onboarding step.
 */
export default function PositioningLoading() {
  return (
    <div className="flex flex-col items-center justify-center p-4 pt-10 min-h-[400px]">
      <LoadingSpinner variant="card" />
    </div>
  );
}
