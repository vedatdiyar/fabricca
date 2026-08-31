"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, GraduationCap, Clock } from "lucide-react";
import { updateTimelineSettingsAction } from "../timeline-actions";
import { toast } from "sonner";
import type {
  TimelineMetrics,
  ThesisDegree,
} from "@/core/services/timeline/timeline-engine";

interface AcademicCalendarDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  metrics: TimelineMetrics | null;
  onSaved: (newMetrics: TimelineMetrics) => void;
}

export function AcademicCalendarDialog({
  isOpen,
  onOpenChange,
  metrics,
  onSaved,
}: AcademicCalendarDialogProps) {
  const [degree, setDegree] = useState<ThesisDegree>(
    metrics?.thesisDegree ?? "MASTER",
  );
  const [targetDateStr, setTargetDateStr] = useState<string>(() => {
    if (!metrics?.targetCompletionDate) return "";
    const d = new Date(metrics.targetCompletionDate);
    return isNaN(d.getTime()) ? "" : (d.toISOString().split("T")[0] ?? "");
  });
  const [weeklyHours, setWeeklyHours] = useState<number>(
    metrics?.weeklyTargetHours ?? 15,
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDateStr) {
      toast.error("Lütfen geçerli bir hedef teslim tarihi seçin.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateTimelineSettingsAction({
        thesisDegree: degree,
        targetCompletionDate: targetDateStr,
        weeklyTargetHours: weeklyHours,
      });

      if (!res.success || !res.data) {
        throw new Error(res.error || "Güncelleme başarısız oldu.");
      }

      toast.success("Akademik takvim ve hedefler başarıyla güncellendi.");
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bağlantı hatası.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Calendar className="size-4 text-primary" />
            Akademik Çalışma Takvimi ve Hedefler
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Tez Türü Seçimi */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <GraduationCap className="size-3.5 text-muted-foreground" />
              Tez Türü
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDegree("MASTER")}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                  degree === "MASTER"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:border-border"
                }`}
              >
                <span className="text-xs font-semibold text-foreground">
                  Yüksek Lisans
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  Tavan: 80 Kaynak
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDegree("DOCTORATE")}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                  degree === "DOCTORATE"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:border-border"
                }`}
              >
                <span className="text-xs font-semibold text-foreground">
                  Doktora Tezi
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  Tavan: 180 Kaynak
                </span>
              </button>
            </div>
          </div>

          {/* Hedef Teslim Tarihi */}
          <div className="space-y-1.5">
            <Label
              htmlFor="targetDate"
              className="text-xs font-medium text-foreground flex items-center gap-1.5"
            >
              <Calendar className="size-3.5 text-muted-foreground" />
              Hedef Teslim Tarihi
            </Label>
            <Input
              id="targetDate"
              type="date"
              value={targetDateStr}
              onChange={(e) => setTargetDateStr(e.target.value)}
              className="text-xs"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Tezinizi enstitüye teslim etmeyi veya savunmaya girmeyi
              hedeflediğiniz tarih.
            </p>
          </div>

          {/* Haftalık Çalışma Saati */}
          <div className="space-y-1.5">
            <Label
              htmlFor="weeklyHours"
              className="text-xs font-medium text-foreground flex items-center gap-1.5"
            >
              <Clock className="size-3.5 text-muted-foreground" />
              Haftalık Ayrılan Çalışma Saati
            </Label>
            <Input
              id="weeklyHours"
              type="number"
              min={1}
              max={80}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(Number(e.target.value))}
              className="text-xs"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Sistemin görev hızını ve haftalık okuma temposunu dengelemesi için
              kullanılır.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Kaydediliyor..." : "Takvimi Güncelle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
