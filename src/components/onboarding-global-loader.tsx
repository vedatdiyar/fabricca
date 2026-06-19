"use client";

import { useOnboardingStore } from "@/lib/store/onboarding-store";

/**
 * Global onboarding loading screen rendered inside the blur overlay.
 * Uses a segmented progress bar mapped exactly to the length of the
 * `loadingSteps` array — no infinite spinners. Each step transitions
 * rhythmically so the user can visually catch green checkmarks.
 * The active step shows a "Thinking Mode" indicator sub-text.
 */
export function OnboardingGlobalLoader() {
  const { loadingTitle, loadingDescription, loadingSteps } =
    useOnboardingStore();

  return (
    <div className="flex flex-col items-center justify-center space-y-10 max-w-5xl mx-auto text-center px-6 w-full">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          {loadingTitle}
        </h2>
        <p className="text-sm text-white/60 leading-relaxed max-w-lg mx-auto">
          {loadingDescription}
        </p>
      </div>

      <div className="w-full bg-white/5 border border-white/10 rounded-xl p-8">
        <div className="flex flex-wrap items-start justify-center gap-y-8 gap-x-6 w-full">
          {loadingSteps.map((step, index) => {
            const isActive = step.status === "active";
            const isCompleted = step.status === "completed";
            return (
              <div
                key={index}
                className="flex-1 min-w-[140px] max-w-[200px] flex flex-col items-center gap-3"
              >
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      isCompleted
                        ? "w-full bg-emerald-400"
                        : isActive
                          ? "w-full bg-gradient-to-r from-emerald-400 via-emerald-400/70 to-emerald-400 animate-pulse"
                          : "w-0"
                    }`}
                  />
                </div>
                <span
                  className={`text-xs leading-tight text-center w-full transition-colors duration-300 ${
                    isCompleted
                      ? "text-emerald-300 font-medium"
                      : isActive
                        ? "text-white font-medium"
                        : "text-white/40"
                  }`}
                >
                  {step.text}
                </span>
                {isActive && (
                  <span className="text-[10px] text-emerald-300/70 animate-pulse leading-tight">
                    Yapılandırılmış akıl yürütme motoru çalıştırılıyor...
                  </span>
                )}
                {isCompleted && (
                  <span className="text-emerald-400">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
