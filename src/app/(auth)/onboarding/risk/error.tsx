"use client";

import { ErrorDisplay } from "@/components/error-display";

/**
 * Onboarding Risk Analiz sayfası için hata yakalayıcı (Client Component / Error Boundary).
 * Tüm hatalar ErrorDisplay bileşeni aracılığıyla maskelenir;
 * hiçbir teknik detay son kullanıcıya sızmaz.
 */
export default function OnboardingRiskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorDisplay error={error} onRetry={reset} />;
}
