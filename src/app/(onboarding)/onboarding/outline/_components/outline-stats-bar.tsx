"use client";

import { Sparkles, Plus, GraduationCap, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OutlineStatsBarProps {
  academicField: string | null;
  sectionCount: number;
  subSectionCount: number;
  onAddSection: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

/**
 * Renders the top statistical toolbar in a single compact row.
 *
 * @param props - Component props.
 * @returns The single-row stats bar markup.
 */
export function OutlineStatsBar({
  academicField,
  sectionCount,
  subSectionCount,
  onAddSection,
  onRegenerate,
  isRegenerating,
}: OutlineStatsBarProps) {
  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 rounded-md border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 bg-primary/10 border-primary/20 text-primary py-1 px-2.5"
        >
          <GraduationCap className="size-3.5" />
          <span className="font-semibold">
            {academicField || "Genel Akademik"}
          </span>
        </Badge>

        <div className="flex items-center gap-2 text-xs text-muted-foreground border-l border-border/60 pl-3 ml-1">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <ListTree className="size-3.5 text-primary" />
            {sectionCount} Bölüm
          </span>
          <span>•</span>
          <span className="font-medium text-foreground">
            {subSectionCount} Alt Bölüm
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap w-full lg:w-auto justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="text-xs gap-1 h-7 px-2.5 border-primary/20 text-primary hover:bg-primary/10"
        >
          <Sparkles
            className={`size-3 ${isRegenerating ? "animate-spin" : ""}`}
          />
          {isRegenerating ? "Yeniden Üretiliyor..." : "Yeniden Üret"}
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onAddSection}
          className="text-xs gap-1 h-7 px-2.5"
        >
          <Plus className="size-3" />
          Yeni Bölüm Ekle
        </Button>
      </div>
    </div>
  );
}
