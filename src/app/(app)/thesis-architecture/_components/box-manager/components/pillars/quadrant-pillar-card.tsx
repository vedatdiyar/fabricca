"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { getQuadrantConfig } from "../../constants/quadrant-config";
import type { BoxWithRelations } from "../../constants/quadrant-config";
import { SubBoxList } from "./sub-box-list";

interface QuadrantPillarCardProps {
  rootBox: BoxWithRelations;
  subBoxes: BoxWithRelations[];
  expandedSemanticMap: Record<number, boolean>;
  onToggleSemantic: (boxId: number) => void;
  onCopySubBox: (box: BoxWithRelations) => void;
  onEditSubBox: (box: BoxWithRelations) => void;
  onDeleteSubBox: (box: BoxWithRelations) => void;
  onAddSubBox: (parentId: number) => void;
  onEditRootBox: (box: BoxWithRelations) => void;
}

/** Main quadrant pillar card: header bar, sub-topic list and clean add actions. */
export function QuadrantPillarCard({
  rootBox,
  subBoxes,
  expandedSemanticMap,
  onToggleSemantic,
  onCopySubBox,
  onEditSubBox,
  onDeleteSubBox,
  onAddSubBox,
  onEditRootBox,
}: QuadrantPillarCardProps) {
  const config = getQuadrantConfig(rootBox.boxType, rootBox.title);

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-card/60 transition-all hover:border-border/90">
      {/* Quadrant Card Header */}
      <div className="p-4 sm:p-5 pb-3.5 border-b border-border/40 space-y-1.5">
        {/* Top Row: Badge + Action Buttons */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className="px-2 py-0.5 text-[11px] font-medium border-border bg-secondary text-secondary-foreground"
          >
            {config.shortLabel}
          </Badge>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary font-medium hover:bg-primary/10 gap-1 rounded-md"
              onClick={() => onAddSubBox(rootBox.id)}
              title="Bu eksene yeni alt konu ekle"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ekle</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md"
              onClick={() => onEditRootBox(rootBox)}
              title="Eksen başlığını düzenle"
              aria-label="Düzenle"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Title */}
        <h2 className="font-serif text-base font-semibold tracking-tight text-foreground leading-snug">
          {rootBox.title}
        </h2>

        {rootBox.description && (
          <p className="font-sans text-xs leading-relaxed text-muted-foreground">
            {rootBox.description}
          </p>
        )}
      </div>

      {/* Sub-Topics List */}
      <div className="flex flex-1 flex-col p-4 sm:p-5 pt-4">
        <SubBoxList
          subBoxes={subBoxes}
          expandedSemanticMap={expandedSemanticMap}
          onToggleSemantic={onToggleSemantic}
          onCopy={onCopySubBox}
          onEdit={onEditSubBox}
          onDelete={onDeleteSubBox}
          onAddSubBox={() => onAddSubBox(rootBox.id)}
        />
      </div>
    </div>
  );
}
