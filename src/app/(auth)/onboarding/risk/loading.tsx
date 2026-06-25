"use client";

import { LoadingSpinner } from "@/components/loading-spinner";

/**
 * Next.js native page loading fallback (F5 / hard navigation).
 * Shows a minimal local spinner while the risk route segment loads.
 * RiskContainer manages its own local loading state; this is just the
 * Suspense fallback during JS chunk loading.
 */
export default function RiskLoading() {
  return <LoadingSpinner variant="full" />;
}
