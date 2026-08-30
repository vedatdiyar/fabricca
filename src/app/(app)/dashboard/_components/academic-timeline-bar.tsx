"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  GraduationCap,
  Lock,
  Unlock,
  Settings2,
  CheckCircle2,
} from "lucide-react";
import { AcademicCalendarDialog } from "./academic-calendar-dialog";
import type { TimelineMetrics } from "@/core/services/timeline/timeline-engine";

interface AcademicTimelineBarProps {
  metrics: TimelineMetrics | null;
  onMetricsUpdated: (newMetrics: TimelineMetrics) => void;
}

export function AcademicTimelineBar({
  metrics,
  onMetricsUpdated,
}: AcademicTimelineBarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const degreeDisplay =
    metrics?.thesisDegree === "DOCTORATE"
      ? "Doktora Tezi"
      : "Yüksek Lisans Tezi";

  const targetDateDisplay = metrics?.targetCompletionDate
    ? new Date(metrics.targetCompletionDate).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Tarih Belirlenmedi";

  return (
    <div className="w-full space-y-3">
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-xs">
        <CardContent className="p-4 space-y-3">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <GraduationCap className="size-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {degreeDisplay}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-border/60 bg-muted/30 text-muted-foreground">
                    <Calendar className="size-3" />
                    Hedef: {targetDateDisplay}
                  </span>
                  {metrics?.isLiteratureFrozen ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-warning/20 bg-warning/10 text-warning">
                      <Lock className="size-3" />
                      Literatür Donduruldu
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-success/20 bg-success/10 text-success">
                      <Unlock className="size-3" />
                      Literatür Taraması Açık
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {metrics?.recommendedWeeklyPaceDescription ||
                    "Tez takviminizi yapılandırın."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <span className="font-mono text-sm font-bold text-foreground">
                  {metrics?.daysRemaining ?? 0}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1">
                  gün kaldı
                </span>
                <div className="text-[11px] text-muted-foreground">
                  Kaynak Havuzu:{" "}
                  <span className="font-semibold text-foreground">
                    {metrics?.currentSourceCount ?? 0}
                  </span>{" "}
                  / {metrics?.maxSourceLimit ?? 80}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setIsDialogOpen(true)}
              >
                <Settings2 className="size-3.5" />
                Takvimi Düzenle
              </Button>
            </div>
          </div>

          {/* 4-Phase Progress Timeline */}
          {metrics && metrics.phases.length > 0 ? (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                {metrics.phases.map((phase) => {
                  const isCurrent = phase.isCurrent;
                  const isDone = phase.isCompleted;

                  return (
                    <div
                      key={phase.phaseNumber}
                      className={`relative flex flex-col p-2.5 rounded-md border text-xs transition-all ${
                        isCurrent
                          ? "border-primary/60 bg-primary/5 shadow-2xs"
                          : isDone
                            ? "border-border/40 bg-muted/10 opacity-75"
                            : "border-border/40 bg-card/40 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          {isDone ? (
                            <CheckCircle2 className="size-3 text-success" />
                          ) : (
                            <span>{phase.phaseNumber}. Faz</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            (%{phase.percentage})
                          </span>
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                            Aktif
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-foreground text-xs truncate">
                        {phase.shortTitle}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(phase.startDate).toLocaleDateString("tr-TR", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        -{" "}
                        {new Date(phase.endDate).toLocaleDateString("tr-TR", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress Line */}
              <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-500"
                  style={{ width: `${metrics.progressPercentage}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between py-2 text-xs text-muted-foreground">
              <span>
                Henüz bir teslim tarihi belirlemediniz. Akademik fazları ve
                kaynak kotalarını aktif etmek için takviminizi yapılandırın.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsDialogOpen(true)}
                className="h-7 text-xs"
              >
                Tarih Belirle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AcademicCalendarDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        metrics={metrics}
        onSaved={onMetricsUpdated}
      />
    </div>
  );
}
