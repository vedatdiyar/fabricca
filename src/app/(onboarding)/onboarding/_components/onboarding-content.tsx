"use client";

import { LoadingOverlayProvider } from "@/providers/loading-overlay-provider";
import { OnboardingGlobalLoader } from "./onboarding-global-loader";
import { useLoadingOverlay } from "@/providers/loading-overlay-provider";

/**
 * Inner content that reads loading state from context.
 *
 * @param root0 - The content props object.
 * @param root0.children - The onboarding step content to render.
 * @returns The onboarding content markup with the optional global loader overlay.
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
 * Client wrapper that provides the loading overlay context to all onboarding pages,
 * rendering children always underneath and conditionally overlaying the global
 * loading screen on top when isLoading is true.
 *
 * @param root0 - The content props object.
 * @param root0.children - The onboarding step content to render.
 * @returns The loading overlay provider wrapper markup.
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
