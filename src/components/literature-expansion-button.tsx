"use client";

import React, { useState } from "react";
import { BookPlus, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  triggerLiteratureExpansionAction,
  undoLiteratureExpansionAction,
} from "@/app/(app)/library/_actions/expansion-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface LiteratureExpansionButtonProps {
  boxId: number;
  expansionCycle?: number;
  isReadyToExpand?: boolean;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Minimal top-right action buttons for automatic literature expansion (2 backward
 * + 2 forward sources) and reverting the latest expansion cycle.
 *
 * @param props - Component props.
 * @param props.boxId - Target Sub-Box ID.
 * @param props.expansionCycle - Current literature expansion cycle index.
 * @param props.isReadyToExpand - Whether all active seed sources are parsed and ready.
 * @param props.onSuccess - Optional callback executed on successful expansion or undo.
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
  const [undoDialogOpen, setUndoDialogOpen] = useState(false);

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

  const handleUndo = async () => {
    if (loading) return;

    setLoading(true);
    setUndoDialogOpen(false);

    try {
      const res = await undoLiteratureExpansionAction(boxId);
      if (res.success) {
        toast.success(`Döngü #${res.data.expansionCycle} geri alındı!`, {
          description: `${res.data.removedSourceCount} adet kaynak kaldırıldı.`,
        });
        onSuccess?.();
      } else {
        toast.error("Geri alma başarısız", {
          description: res.error,
        });
      }
    } catch {
      toast.error("Bir hata oluştu", {
        description: "Geri alma servisi yanıt vermedi.",
      });
    } finally {
      setLoading(false);
    }
  };

  const canUndo = expansionCycle > 1;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="inline-flex h-7 items-center px-2 text-[10px] font-semibold text-muted-foreground bg-muted rounded-md border border-border"
        title="Literatür Genişletme Döngü Sayısı"
      >
        Döngü #{expansionCycle}
      </span>

      {isReadyToExpand && (
        <button
          type="button"
          onClick={handleExpand}
          disabled={loading}
          title="Otomatik Literatür Genişletmeyi Çalıştır (2 Geriye + 2 İleriye Kaynak)"
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all duration-200",
            !loading
              ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 active:scale-95 cursor-pointer"
              : "bg-muted/50 text-muted-foreground/60 border-border cursor-not-allowed opacity-70",
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <BookPlus className="h-4 w-4 text-primary" />
          )}
        </button>
      )}

      {canUndo && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setUndoDialogOpen(true);
          }}
          disabled={loading}
          title="Son Genişletme Döngüsünü Geri Al"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground hover:text-destructive hover:border-destructive/20 hover:bg-destructive/10 transition-colors"
        >
          <Undo2 className="h-4 w-4" />
        </button>
      )}

      <AlertDialog
        open={undoDialogOpen}
        onOpenChange={(open) => {
          if (!open) setUndoDialogOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold text-foreground">
              Son Genişletme Döngüsünü Geri Almak İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Döngü #{expansionCycle} sırasında eklenen tüm kaynaklar silinecek
              ve döngü bir önceki hale ({`Döngü #${expansionCycle - 1}`})
              dönecektir. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-medium">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUndo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium"
            >
              Evet, Geri Al
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
