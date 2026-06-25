"use client";

import { LoadingSpinner } from "@/components/loading-spinner";

/**
 * EnrichmentLoadingSkeleton — enrichment adımı veri yüklenirken gösterilen spinner.
 * Matrix adımının yükleme durumunyla görsel olarak tutarlıdır.
 */
export function EnrichmentLoadingSkeleton() {
  return <LoadingSpinner variant="card" />;
}
