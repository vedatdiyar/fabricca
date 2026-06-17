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
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{
            background: "#0b100e",
            opacity: 0.8,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="opacity-100">
            <OnboardingGlobalLoader />
          </div>
        </div>
      )}
    </div>
  );
}
