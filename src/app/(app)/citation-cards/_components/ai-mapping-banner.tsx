"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createFlowId, Logger } from "@/lib/logger";
import { autoMapCitationCardsAction } from "../actions";

interface AiMappingBannerProps {
  unassignedCount: number;
  onRefresh: () => Promise<void>;
}

/**
 * Ambient AI Mapping Banner for Citation Cards.
 * Displayed only when there are unassigned cards waiting for outline assignment.
 *
 * @param props - Component props.
 * @returns Rendered banner markup or null.
 */
export function AiMappingBanner({
  unassignedCount,
  onRefresh,
}: AiMappingBannerProps) {
  const [isMapping, setIsMapping] = useState(false);

  if (unassignedCount === 0) return null;

  const handleAutoMap = async () => {
    setIsMapping(true);
    const toastId = toast.loading(
      "Yapay zeka fişleri analiz ediyor ve bölümlere eşliyor...",
    );

    try {
      const result = await autoMapCitationCardsAction();
      if (result.success) {
        toast.success(
          `${result.data.mappedCount} alıntı fişi ilgili tez bölümlerine başarıyla yerleştirildi.`,
          { id: toastId },
        );
        await onRefresh();
      } else {
        toast.error(result.error, { id: toastId });
      }
    } catch (err) {
      new Logger(createFlowId()).error("handleAutoMap error:", {
        service: "citation-cards",
        error: err,
      });
      toast.error(
        "Yapay zeka eşlemesi sırasında beklenmeyen bir hata oluştu.",
        {
          id: toastId,
        },
      );
    } finally {
      setIsMapping(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-3.5 py-2 rounded-lg border border-warning/20 bg-warning/10 text-foreground animate-in fade-in-50 duration-200">
      <div className="flex items-center gap-2 text-xs">
        <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
        <span>
          <strong className="font-semibold text-warning">
            {unassignedCount} alıntı fişi
          </strong>{" "}
          henüz bir tez bölümüne yerleştirilmedi.
        </span>
      </div>

      <Button
        onClick={handleAutoMap}
        disabled={isMapping}
        size="sm"
        className="gap-1.5 h-7 px-2.5 text-xs font-medium bg-warning text-warning-foreground hover:bg-warning/90 shrink-0 w-full sm:w-auto cursor-pointer"
      >
        {isMapping ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Dağıtılıyor...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3" />
            <span>Yapay Zeka ile Dağıt</span>
          </>
        )}
      </Button>
    </div>
  );
}
