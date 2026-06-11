"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * Onboarding Risk Analiz sayfası için hata yakalayıcı (Client Component / Error Boundary).
 * İstisna durumlarında kullanıcı dostu hata ekranı ve yeniden deneme butonu sağlar.
 */
export default function OnboardingRiskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Risk page error caught:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center justify-center space-y-6 max-w-md mx-auto text-center">
        <div className="p-4 bg-card rounded-full border border-destructive text-destructive">
          <AlertTriangle className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Risk Analizinde Sorun Oluştu
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {error.message ||
              "Tavily veya Tezara arama motorlarına bağlanırken bir hata yaşandı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin."}
          </p>
        </div>

        <Button
          onClick={() => reset()}
          className="px-8 py-6 text-sm font-semibold"
        >
          Yeniden Dene
        </Button>
      </div>
    </main>
  );
}
