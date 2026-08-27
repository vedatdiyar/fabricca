"use client";

import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { Target, Compass, Database, BookOpen, CheckCircle2, Clock, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ThesisMatrix } from "@/lib/types";

interface QuadrantConfig {
  key: keyof ThesisMatrix;
  number: string;
  Icon: LucideIcon;
  label: string;
  hint: string;
}

const QUADRANTS: QuadrantConfig[] = [
  { key: "subjectProblem", number: "01", Icon: Target, label: "Araştırma Problemi, Aktörler ve Odak", hint: "Neyi, hangi problemi ve hangi aktörleri inceliyorsun?" },
  { key: "theoreticalFramework", number: "02", Icon: Compass, label: "Teorik ve Kavramsal Çerçeve", hint: "Hangi teorik mercek ve kavramsal model?" },
  { key: "primaryMaterial", number: "03", Icon: Database, label: "Veri Kaynağı / Birincil Malzeme", hint: "Hangi birincil kaynaklar ve veri setleri?" },
  { key: "methodology", number: "04", Icon: BookOpen, label: "Metodoloji", hint: "Veri nasıl toplanıyor ve analiz ediliyor?" },
];

interface MatrixReviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  matrix: Partial<ThesisMatrix>;
  completedCount: number;
  isFullyReady: boolean;
  isSubmitting: boolean;
  onConfirm: () => void | Promise<void>;
}

export const MatrixReviewModal = memo(function MatrixReviewModal({
  isOpen,
  onOpenChange,
  matrix,
  completedCount,
  isFullyReady,
  isSubmitting,
  onConfirm,
}: MatrixReviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-lg border border-border bg-card">
        <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="font-serif text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            Tez Matrisi Önizleme
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
              {completedCount}/4 kadran
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Aşağıda danışmanla birlikte olgunlaştırdığın 4 kadran alt alta listeleniyor. Eksik varsa sohbete dönüp tamamlayabilir, hazırsa mühürleyip konumlandırma adımına geçebilirsin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {QUADRANTS.map(({ key, number, Icon, label, hint }) => {
            const value = matrix[key]?.trim() ?? "";
            const isCompleted = value.length >= 20;
            const isDiscussing = value.length > 0 && !isCompleted;

            return (
              <Card
                key={key}
                className={`p-4 rounded-lg border flex flex-col gap-2 ${
                  isCompleted
                    ? "border-primary/20 bg-background/60"
                    : isDiscussing
                      ? "border-warning/20 bg-background/60"
                      : "border-border/60 bg-background/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-primary/10 text-xs font-mono font-semibold tracking-wider text-primary">
                      {number}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                  </div>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-success/10 border border-success/20 text-success shrink-0">
                      <CheckCircle2 className="size-3" />
                      Mühürlendi
                    </span>
                  ) : isDiscussing ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-warning/10 border border-warning/20 text-warning shrink-0">
                      <Clock className="size-3" />
                      Müzakerede
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border shrink-0">
                      Beklemede
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>
                {value ? (
                  <p className="text-sm font-normal leading-relaxed font-sans text-foreground whitespace-pre-wrap pt-1 border-t border-border/40">
                    {value}
                  </p>
                ) : (
                  <p className="text-xs italic text-muted-foreground pt-1 border-t border-border/40">Henüz olgunlaştırılmadı — danışmanla sohbet ettikçe burası dolacak.</p>
                )}
              </Card>
            );
          })}
        </div>

        <div className="p-4 border-t border-border bg-card shrink-0 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-9 text-xs px-3 rounded-md">
            Kapat
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!isFullyReady || isSubmitting}
            className="h-9 text-sm px-5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer inline-flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Mühürleniyor...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Mühürle ve İlerle
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
