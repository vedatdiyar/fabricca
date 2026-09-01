"use client";

import React from "react";
import { BookOpen, CheckCircle2, FileText, Layers } from "lucide-react";
import { MetricCard } from "@/components/shared/metrics/metric-card";
import { MetricsGrid } from "@/components/shared/metrics/metrics-grid";
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
    <MetricsGrid>
      {statItems.map((item) => (
        <MetricCard
          key={item.label}
          label={item.label}
          value={item.value}
          subtext={item.subtext}
          icon={item.icon}
          iconClassName={item.colorClass}
        />
      ))}
    </MetricsGrid>
  );
}
