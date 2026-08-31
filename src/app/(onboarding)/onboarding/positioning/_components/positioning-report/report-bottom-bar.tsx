"use client";

import { useRouter } from "next/navigation";
import { RefreshCw, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportBottomBarProps {
  isDirectOverlap: boolean;
  confirming: boolean;
  onConfirm: () => void;
}

/**
 * Renders bottom action bar for positioning report.
 *
 * @param props - Bottom bar props.
 * @returns Bottom bar markup.
 */
export function ReportBottomBar({
  isDirectOverlap,
  confirming,
  onConfirm,
}: ReportBottomBarProps) {
  const router = useRouter();

  if (isDirectOverlap) {
    return null;
  }

  return (
    <div className="flex justify-between items-center pt-4 pb-8 border-t border-border/40">
      <Button
        variant="outline"
        size="default"
        onClick={() => router.push("/onboarding/proposal")}
        disabled={confirming}
      >
        <RefreshCw className="size-4 mr-2" />
        Taslağı Düzenle
      </Button>

      <Button
        onClick={onConfirm}
        disabled={confirming}
        size="lg"
      >
        {confirming ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Konu Kutuları Hazırlanıyor...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Konumlandırmayı Onayla
            <ArrowRight className="size-4" />
          </span>
        )}
      </Button>
    </div>
  );
}
