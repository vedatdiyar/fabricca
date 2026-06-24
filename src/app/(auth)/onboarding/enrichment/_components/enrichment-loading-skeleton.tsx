"use client";

import { Loader2 } from "lucide-react";

/**
 * EnrichmentLoadingSkeleton — enrichment adımı veri yüklenirken gösterilen spinner.
 * Matrix adımının yükleme durumunyla görsel olarak tutarlıdır.
 */
export function EnrichmentLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}
