"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
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
      console.error("handleAutoMap error:", err);
      toast.error("Yapay zeka eşlemesi sırasında beklenmeyen bir hata oluştu.", {
        id: toastId,
      });
    } finally {
      setIsMapping(false);
    }
  };

  return (
    <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-md border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200 animate-in fade-in-50 duration-200">
      <div className="flex items-center gap-2 text-xs">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          <strong className="font-semibold text-amber-700 dark:text-amber-300">
            {unassignedCount} alıntı fişiniz
          </strong>{" "}
          henüz bir tez bölümüne atanmadı.
        </span>
      </div>

      <Button
        onClick={handleAutoMap}
        disabled={isMapping}
        size="sm"
        className="gap-1.5 h-8 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white shrink-0 w-full sm:w-auto"
      >
        {isMapping ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Bölümlere Dağıtılıyor...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            <span>Yapay Zeka ile Bölümlere Dağıt</span>
          </>
        )}
      </Button>
    </Card>
  );
}
