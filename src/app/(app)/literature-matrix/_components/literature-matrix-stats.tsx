"use client";

import React from "react";
import { BookOpen, CheckCircle2, FileText, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MatrixStats } from "../types";

interface LiteratureMatrixStatsProps {
  stats: MatrixStats;
}

/**
 * Renders summary metrics cards at the top of the Literature Matrix workspace.
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
      colorClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Eser Analizleri",
      value: `${stats.completedCritiques} / ${stats.totalSources}`,
      subtext: "5 Boyutlu analiz tamamlandı",
      icon: FileText,
      colorClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      label: "Kapsanan Temalar",
      value: stats.uniqueBoxes,
      subtext: "Tez kutusu eşleşti",
      icon: Layers,
      colorClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.label}
            className="border border-border bg-card shadow-xs"
          >
            <CardContent className="flex items-center justify-between p-4.5">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="font-serif text-2xl font-bold tracking-tight text-foreground">
                  {item.value}
                </p>
                <p className="text-xs text-muted-foreground">{item.subtext}</p>
              </div>
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border ${item.colorClass}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
