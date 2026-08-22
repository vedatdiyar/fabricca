"use client";

import React from "react";
import { BookOpen, CheckCircle2, FileText, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MatrixStats } from "../_lib/types";

interface LiteratureMatrixStatsProps {
  stats: MatrixStats;
}

/**
 * Renders sleek, minimal summary metrics cards at the top of the Literature Matrix workspace.
 *
 * @param root0 - Component props.
 * @param root0.stats - Matrix summary figures.
 * @returns The rendered statistics cards markup.
 */
export function LiteratureMatrixStats({ stats }: LiteratureMatrixStatsProps) {
  const statItems = [
    {
      label: "Toplam Kaynak",
      value: stats.totalSources,
      subtext: "Analiz edilen eserler",
      icon: BookOpen,
      colorClass: "text-primary bg-primary/10 border-primary/20",
    },
    {
      label: "Okunmuş Kaynaklar",
      value: `${stats.readSources} / ${stats.totalSources}`,
      subtext:
        stats.totalSources > 0
          ? `%${Math.round((stats.readSources / stats.totalSources) * 100)} okundu`
          : "Okuma bulunmuyor",
      icon: CheckCircle2,
      colorClass: "text-primary bg-primary/10 border-primary/20",
    },
    {
      label: "Eser Analizleri",
      value: `${stats.completedCritiques} / ${stats.totalSources}`,
      subtext: "5 Boyutlu analiz tamamlandı",
      icon: FileText,
      colorClass: "text-primary bg-primary/10 border-primary/20",
    },
    {
      label: "Kapsanan Temalar",
      value: stats.uniqueBoxes,
      subtext: "Tez kutusu eşleşti",
      icon: Layers,
      colorClass: "text-primary bg-primary/10 border-primary/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border border-border bg-card">
            <CardContent className="flex items-center justify-between p-3">
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground truncate">
                  {item.label}
                </p>
                <p className="font-sans text-lg font-semibold tracking-tight text-foreground">
                  {item.value}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.subtext}
                </p>
              </div>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${item.colorClass}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
