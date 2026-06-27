"use client";

import { LoadingOverlayProvider } from "@/components/providers/loading-overlay-provider";
import { OnboardingGlobalLoader } from "@/components/onboarding-global-loader";
import { useLoadingOverlay } from "@/components/providers/loading-overlay-provider";

/**
 * Inner content that reads loading state from context.
 */
function OnboardingInner({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isLoading } = useLoadingOverlay();

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      {children}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
          <div className="w-full max-w-5xl px-6">
            <OnboardingGlobalLoader />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Client wrapper that provides the loading overlay context to all onboarding
 * pages. Renders children always underneath and conditionally overlays the
 * global loading screen on top when isLoading is true.
 */
export function OnboardingContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LoadingOverlayProvider>
      <OnboardingInner>{children}</OnboardingInner>
    </LoadingOverlayProvider>
  );
}
