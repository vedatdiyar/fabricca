"use client";

import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { PillarCard } from "@/components/thesis/pillar-card";
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
    <PillarCard
      variant="muted"
      badgeLabel={config.shortLabel}
      title={rootBox.title}
      description={rootBox.description ?? undefined}
      headerActions={
        <>
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
        </>
      }
    >
      <SubBoxList
        subBoxes={subBoxes}
        expandedSemanticMap={expandedSemanticMap}
        onToggleSemantic={onToggleSemantic}
        onCopy={onCopySubBox}
        onEdit={onEditSubBox}
        onDelete={onDeleteSubBox}
        onAddSubBox={() => onAddSubBox(rootBox.id)}
      />
    </PillarCard>
  );
}
