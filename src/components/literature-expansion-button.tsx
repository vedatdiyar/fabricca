"use client";

import React, { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { triggerLiteratureExpansionAction } from "@/app/(app)/library/_actions/expansion-actions";
import { cn } from "@/lib/utils";

interface LiteratureExpansionButtonProps {
  boxId: number;
  expansionCycle?: number;
  isReadyToExpand?: boolean;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Minimal top-right action button for triggering automatic literature expansion (2 backward + 2 forward sources).
 *
 * @param props - Component props.
 * @param props.boxId - Target Sub-Box ID.
 * @param props.expansionCycle - Current literature expansion cycle index.
 * @param props.isReadyToExpand - Whether all active seed sources are parsed and ready.
 * @param props.onSuccess - Optional callback executed on successful expansion.
 * @param props.className - Additional class names for styling.
 * @returns Literature expansion button markup.
 */
export function LiteratureExpansionButton({
  boxId,
  expansionCycle = 1,
  isReadyToExpand = true,
  onSuccess,
  className,
}: LiteratureExpansionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isReadyToExpand || loading) return;

    setLoading(true);
    toast.info("Otomatik Literatür Genişletme başlatılıyor...", {
      description: "2 geriye + 2 ileriye atıf kaynakları sorgulanıyor.",
    });

    try {
      const res = await triggerLiteratureExpansionAction(boxId);
      if (res.success) {
        toast.success(`Döngü #${res.data.expansionCycle} Tamamlandı!`, {
          description: `4 yeni kaynak eklendi (${res.data.addedSources.length} adet).`,
        });
        onSuccess?.();
      } else {
        toast.error("Literatür genişletme başarısız", {
          description: res.error,
        });
      }
    } catch {
      toast.error("Bir hata oluştu", {
        description: "Literatür genişletme servisi yanıt vermedi.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="inline-flex h-7 items-center px-2 text-[10px] font-semibold text-muted-foreground bg-muted rounded-md border border-border"
        title="Literatür Genişletme Döngü Sayısı"
      >
        Döngü #{expansionCycle}
      </span>

      <button
        type="button"
        onClick={handleExpand}
        disabled={!isReadyToExpand || loading}
        title={
          isReadyToExpand
            ? "Otomatik Literatür Genişletmeyi Çalıştır (2 Geriye + 2 İleriye Kaynak)"
            : "Genişletmeyi tetiklemek için aktif 4 seed kaynağın hazır olması gerekir."
        }
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all duration-200",
          isReadyToExpand && !loading
            ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 active:scale-95 cursor-pointer"
            : "bg-muted/50 text-muted-foreground/60 border-border cursor-not-allowed opacity-70",
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Sparkles className="h-4 w-4 text-primary" />
        )}
      </button>
    </div>
  );
}
