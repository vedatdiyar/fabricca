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
        size="sm"
        onClick={() => router.push("/onboarding/proposal")}
        disabled={confirming}
        className="h-8 text-xs px-3 rounded-md [&_svg]:size-3.5 cursor-pointer"
      >
        <RefreshCw className="size-3.5 mr-1.5" />
        Taslağı Düzenle
      </Button>

      <Button
        onClick={onConfirm}
        disabled={confirming}
        size="sm"
        className="h-8 text-xs px-3 rounded-md [&_svg]:size-3.5 cursor-pointer"
      >
        {confirming ? (
          <span className="flex items-center justify-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" />
            Konu Kutuları Hazırlanıyor...
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            Konumlandırmayı Onayla ve Konu Kutularını Oluştur
            <ArrowRight className="size-3.5" />
          </span>
        )}
      </Button>
    </div>
  );
}
