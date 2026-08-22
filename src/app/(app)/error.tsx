"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createFlowId, Logger } from "@/lib/logger";

/**
 * Route-level error boundary for authenticated app routes.
 *
 * @param root0 - Error boundary props.
 * @param root0.error - The error that triggered the boundary.
 * @param root0.reset - Callback to retry rendering the failed segment.
 * @returns The Turkish error fallback UI.
 */
export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    new Logger(createFlowId()).error("AppRouteError", {
      service: "ui",
      error,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
        Bir şeyler ters gitti.
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        İşlemin tamamlanması sırasında beklenmeyen bir hata oluştu. Yeniden
        deneyerek sayfa içeriğini kurtarabilirsin.
      </p>
      <Button onClick={reset}>Tekrar Dene</Button>
    </div>
  );
}
