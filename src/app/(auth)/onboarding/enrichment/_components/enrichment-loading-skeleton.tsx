"use client";

import { Loader2 } from "lucide-react";

/**
 * EnrichmentLoadingSkeleton component renders a simple centered spinner.
 * It is displayed while the onboarding matrix data is being fetched.
 */
export function EnrichmentLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}
