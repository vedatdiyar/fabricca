"use client";

import { Loader2 } from "lucide-react";

/**
 * Next.js native page loading fallback (F5 / hard navigation).
 * Shows a minimal local spinner while the risk route segment loads.
 * RiskContainer manages its own local loading state; this is just the
 * Suspense fallback during JS chunk loading.
 */
export default function RiskLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}
