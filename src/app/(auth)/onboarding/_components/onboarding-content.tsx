"use client";

import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { OnboardingGlobalLoader } from "@/components/onboarding-global-loader";

/**
 * Client wrapper that renders children always underneath and conditionally
 * overlays the global loading screen on top when isLoading is true.
 * The overlay uses a deep-emerald/black background with backdrop-blur so
 * the active form/view remains visible but inaccessible underneath.
 */
export function OnboardingContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isLoading = useOnboardingStore((s) => s.isLoading);

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      {children}
      {isLoading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: "#0b100e",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <div className="w-full max-w-5xl px-6">
            <OnboardingGlobalLoader />
          </div>
        </div>
      )}
    </div>
  );
}
