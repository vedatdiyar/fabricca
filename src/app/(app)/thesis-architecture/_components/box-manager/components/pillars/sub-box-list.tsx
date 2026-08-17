"use client";

import { Plus } from "lucide-react";
import { SubBoxItem } from "./sub-box-item";
import type { BoxWithRelations } from "../../constants/quadrant-config";

interface SubBoxListProps {
  subBoxes: BoxWithRelations[];
  expandedSemanticMap: Record<number, boolean>;
  onToggleSemantic: (boxId: number) => void;
  onCopy: (box: BoxWithRelations) => void;
  onEdit: (box: BoxWithRelations) => void;
  onDelete: (box: BoxWithRelations) => void;
  onAddSubBox: () => void;
}

/** Sub-topic list of a quadrant pillar, or the clickable empty state placeholder. */
export function SubBoxList({
  subBoxes,
  expandedSemanticMap,
  onToggleSemantic,
  onCopy,
  onEdit,
  onDelete,
  onAddSubBox,
}: SubBoxListProps) {
  if (subBoxes.length === 0) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onAddSubBox}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && onAddSubBox?.()
        }
        className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/5 p-6 text-center hover:border-primary/40 hover:bg-muted/15 transition-colors min-h-[140px] space-y-2 group"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 text-muted-foreground group-hover:text-primary transition-colors">
          <Plus className="h-4 w-4" />
        </div>
        <p className="font-serif text-xs font-semibold text-foreground">
          Bu eksen altında alt konu bulunmuyor
        </p>
        <p className="font-sans text-[10px] text-muted-foreground max-w-xs">
          Yeni bir tematik odak veya ampirik alt havuz eklemek için tıklayın.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {subBoxes.map((subBox) => (
        <SubBoxItem
          key={subBox.id}
          subBox={subBox}
          isSemanticOpen={expandedSemanticMap[subBox.id] ?? false}
          onToggleSemantic={() => onToggleSemantic(subBox.id)}
          onCopy={() => onCopy(subBox)}
          onEdit={() => onEdit(subBox)}
          onDelete={() => onDelete(subBox)}
        />
      ))}
    </div>
  );
}
