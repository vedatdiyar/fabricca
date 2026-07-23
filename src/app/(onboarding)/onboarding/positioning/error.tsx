"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PositioningErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary component for the positioning onboarding step.
 */
export default function PositioningError({
  error,
  reset,
}: PositioningErrorProps) {
  useEffect(() => {
    console.error("Positioning page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
      <div className="rounded-full bg-destructive/10 p-3 mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">
        Bir Hata Oluştu
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Konumlandırma matrisi yüklenirken beklenmeyen bir hata meydana geldi.
        Lütfen sayfayı yenilemeyi veya tekrar denemeyi deneyin.
      </p>
      <Button onClick={() => reset()} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Tekrar Dene
      </Button>
    </div>
  );
}
