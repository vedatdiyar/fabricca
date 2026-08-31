"use client";

import {
  ChevronRight,
  ChevronUp,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  GripVertical,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useOutlineSectionCard,
  type OutlineSectionCardProps,
} from "../_hooks/use-outline-section-card";
import { SubSectionTreeList } from "./sub-section-tree-list";

export type {
  OutlineSectionData,
  OutlineSubSectionData,
} from "../_hooks/use-outline-section-card";

/**
 * Renders an interactive main section card with inline editing, drag-and-drop
 * reordering for sections and subsections, and subsection management.
 *
 * @param props - Component props.
 * @returns The section card markup.
 */
export function OutlineSectionCard(props: OutlineSectionCardProps) {
  const {
    section,
    sectionIndex,
    isExpanded,
    onToggleExpand,
    onDeleteSection,
    onDragStartSection,
    onDragOverSection,
    onDropSection,
    onDragEndSection,
    isDraggingSection = false,
    isDragOverSection = false,
  } = props;

  const {
    cardState,
    updateCardState,
    sectionNumber,
    subSections,
    hasSubSections,
    isSpecialSection,
    handleSaveSectionEdit,
    handleCancelSectionEdit,
    handleAddSubSection,
    handleDeleteSubSection,
    handleSubDrop,
    handleStartSubEdit,
    handleSaveSubEdit,
  } = useOutlineSectionCard(props);

  const {
    isEditingSection,
    editTitle,
    editDescription,
    editingSubIndex,
    subEditTitle,
    subEditDescription,
    draggedSubIdx,
    dragOverSubIdx,
  } = cardState;

  return (
    <Card
      draggable={!isEditingSection && editingSubIndex === null}
      onDragStart={() => onDragStartSection(sectionIndex)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverSection(sectionIndex);
      }}
      onDrop={() => onDropSection(sectionIndex)}
      onDragEnd={onDragEndSection}
      className={`flex flex-col w-full p-4 rounded-md border bg-card transition-all duration-200 ${
        isDraggingSection ? "opacity-40 border-primary" : "border-border"
      } ${isDragOverSection ? "border-primary ring-2 ring-primary/10" : "hover:border-primary/20"}`}
    >
      {/* Header Row */}
      <div
        className={`flex ${
          isEditingSection ? "items-start" : "items-center"
        } justify-between gap-3`}
      >
        <div
          className={`flex ${
            isEditingSection ? "items-start" : "items-center"
          } gap-3 flex-1 min-w-0`}
        >
          {/* Drag Handle & Section Number */}
          <div
            className={`flex items-center gap-1 shrink-0 ${
              isEditingSection ? "mt-1" : ""
            }`}
          >
            <span
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-muted-foreground p-0.5 rounded transition-colors"
              title="Bölümü Taşı"
            >
              <GripVertical className="size-4" />
            </span>
            <span className="flex size-7 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary shrink-0">
              {sectionNumber}
            </span>
          </div>

          {/* Section Info / Inline Edit */}
          <div className="flex-1 min-w-0">
            {isEditingSection ? (
              <div className="space-y-2">
                <Input
                  value={editTitle}
                  onChange={(e) =>
                    updateCardState({ editTitle: e.target.value })
                  }
                  className="font-serif text-base font-semibold"
                  placeholder="Bölüm başlığı..."
                />
                <Textarea
                  value={editDescription}
                  onChange={(e) =>
                    updateCardState({ editDescription: e.target.value })
                  }
                  className="text-xs min-h-[60px]"
                  placeholder="Bölüm açıklaması..."
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveSectionEdit}
                  >
                    <Check className="size-3.5" /> Kaydet
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelSectionEdit}
                  >
                    <X className="size-3.5" /> İptal
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-semibold tracking-tight text-foreground leading-snug">
                    {section.title}
                  </h3>
                </div>
                {section.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    {section.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section Actions */}
        {!isEditingSection && !isSpecialSection && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateCardState({ isEditingSection: true })}
              className="text-muted-foreground hover:text-foreground"
              title="Bölümü Düzenle"
            >
              <Pencil className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleAddSubSection}
              className="text-primary hover:bg-primary/10"
              title="Alt Bölüm Ekle"
            >
              <Plus className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onDeleteSection}
              className="text-destructive hover:bg-destructive/10"
              title="Bölümü Sil"
            >
              <Trash2 className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      <SubSectionTreeList
        subSections={subSections}
        sectionNumber={sectionNumber}
        isSpecialSection={isSpecialSection}
        hasSubSections={hasSubSections}
        isExpanded={isExpanded}
        editingSubIndex={editingSubIndex}
        draggedSubIdx={draggedSubIdx}
        dragOverSubIdx={dragOverSubIdx}
        subEditTitle={subEditTitle}
        subEditDescription={subEditDescription}
        onAddSubSection={handleAddSubSection}
        onStartSubEdit={handleStartSubEdit}
        onSaveSubEdit={handleSaveSubEdit}
        onDeleteSubSection={handleDeleteSubSection}
        onSubDrop={handleSubDrop}
        onUpdateCardState={updateCardState}
      />
    </Card>
  );
}
