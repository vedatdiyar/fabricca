"use client";

import { Plus, Pencil, Trash2, Check, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  OutlineSubSectionData,
  OutlineCardState,
} from "../_hooks/use-outline-section-card";

interface SubSectionTreeListProps {
  subSections: OutlineSubSectionData[];
  sectionNumber: number;
  isSpecialSection: boolean;
  hasSubSections: boolean;
  isExpanded: boolean;
  editingSubIndex: number | null;
  draggedSubIdx: number | null;
  dragOverSubIdx: number | null;
  subEditTitle: string;
  subEditDescription: string;
  onAddSubSection: () => void;
  onStartSubEdit: (idx: number) => void;
  onSaveSubEdit: (idx: number) => void;
  onDeleteSubSection: (idx: number) => void;
  onSubDrop: (targetIdx: number) => void;
  onUpdateCardState: (patch: Partial<OutlineCardState>) => void;
}

/**
 * Renders the collapsible subsection list of a section card with inline
 * editing and drag-and-drop reordering.
 *
 * @param props - The subsection tree list props.
 * @returns The subsection list markup or null when collapsed.
 */
export function SubSectionTreeList({
  subSections,
  sectionNumber,
  isSpecialSection,
  hasSubSections,
  isExpanded,
  editingSubIndex,
  draggedSubIdx,
  dragOverSubIdx,
  subEditTitle,
  subEditDescription,
  onAddSubSection,
  onStartSubEdit,
  onSaveSubEdit,
  onDeleteSubSection,
  onSubDrop,
  onUpdateCardState,
}: SubSectionTreeListProps) {
  if (!isExpanded || (isSpecialSection && !hasSubSections)) return null;

  return (
    <div className="mt-3 space-y-2">
      {subSections.length === 0 ? (
        <div className="flex items-center justify-between py-2 text-xs text-muted-foreground bg-muted/20 px-3 rounded-md border border-dashed border-border/50">
          <span>Bu bölüm için henüz alt bölüm eklenmedi.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddSubSection}
            className="text-primary hover:bg-primary/10 shrink-0"
          >
            <Plus className="size-3.5" /> Alt Bölüm Ekle
          </Button>
        </div>
      ) : (
        subSections.map((sub, subIdx) => {
          const isSubEditing = editingSubIndex === subIdx;
          const isSubDragging = draggedSubIdx === subIdx;
          const isSubDragOver = dragOverSubIdx === subIdx;

          return (
            <div
              key={`${sub.title}-${subIdx}`}
              draggable={!isSubEditing}
              onDragStart={(e) => {
                e.stopPropagation();
                onUpdateCardState({ draggedSubIdx: subIdx });
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUpdateCardState({ dragOverSubIdx: subIdx });
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSubDrop(subIdx);
              }}
              onDragEnd={() => {
                onUpdateCardState({
                  draggedSubIdx: null,
                  dragOverSubIdx: null,
                });
              }}
              className={cn(
                "group/sub relative rounded-md border border-border/60 bg-card/40 p-2.5 transition-all text-xs",
                isSubDragging && "opacity-40 border-dashed border-primary",
                isSubDragOver && "border-primary bg-primary/5",
              )}
            >
              {isSubEditing ? (
                <div className="space-y-2">
                  <Input
                    value={subEditTitle}
                    onChange={(e) =>
                      onUpdateCardState({ subEditTitle: e.target.value })
                    }
                    placeholder="Alt bölüm başlığı..."
                    className="text-xs h-8"
                    autoFocus
                  />
                  <Textarea
                    value={subEditDescription}
                    onChange={(e) =>
                      onUpdateCardState({
                        subEditDescription: e.target.value,
                      })
                    }
                    placeholder="Alt bölüm açıklaması..."
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onSaveSubEdit(subIdx)}
                    >
                      <Check className="size-3.5" /> Kaydet
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onUpdateCardState({ editingSubIndex: null })
                      }
                    >
                      <X className="size-3.5" /> İptal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
                        title="Sürükleyip Sırasını Değiştirin"
                      >
                        <GripVertical className="size-3.5" />
                      </span>
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-semibold shrink-0">
                        {sectionNumber}.{subIdx + 1}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="font-sans text-sm font-medium text-foreground leading-snug">
                        {sub.title}
                      </h4>
                      {sub.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {sub.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover/sub:opacity-100 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onStartSubEdit(subIdx)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Düzenle"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteSubSection(subIdx)}
                      className="text-destructive hover:bg-destructive/10"
                      title="Sil"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
