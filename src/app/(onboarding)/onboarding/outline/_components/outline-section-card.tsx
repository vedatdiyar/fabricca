"use client";

import { useState, useCallback, useMemo } from "react";
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

export interface OutlineSubSectionData {
  title: string;
  description: string;
  sortOrder: number;
}

export interface OutlineSectionData {
  title: string;
  description: string;
  sortOrder: number;
  subSections?: OutlineSubSectionData[];
}

interface OutlineSectionCardProps {
  section: OutlineSectionData;
  sectionIndex: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateSection: (updated: OutlineSectionCardProps["section"]) => void;
  onDeleteSection: () => void;
  // Drag & drop props for main sections
  onDragStartSection: (index: number) => void;
  onDragOverSection: (index: number) => void;
  onDropSection: (targetIndex: number) => void;
  onDragEndSection: () => void;
  isDraggingSection?: boolean;
  isDragOverSection?: boolean;
}

/**
 * Renders an interactive main section card with inline editing, drag-and-drop reordering
 * for sections and subsections, and subsection management without left border lines.
 *
 * @param props - Component props.
 * @returns The section card markup.
 */
function useOutlineSectionCardLogic(props: OutlineSectionCardProps) {
  const { section, sectionIndex, isExpanded, onToggleExpand, onUpdateSection } =
    props;

  const [cardState, setCardState] = useState({
    isEditingSection: false,
    editTitle: section.title,
    editDescription: section.description,
    editingSubIndex: null as number | null,
    subEditTitle: "",
    subEditDescription: "",
    draggedSubIdx: null as number | null,
    dragOverSubIdx: null as number | null,
  });

  const updateCardState = useCallback((patch: Partial<typeof cardState>) => {
    setCardState((prev) => ({ ...prev, ...patch }));
  }, []);

  const sectionNumber = sectionIndex + 1;
  const subSections = useMemo(
    () => section.subSections ?? [],
    [section.subSections],
  );
  const hasSubSections = subSections.length > 0;

  const isSpecialSection = useMemo(() => {
    const titleUpper = section.title.toLocaleUpperCase("tr-TR");
    return (
      titleUpper.includes("GİRİŞ") ||
      titleUpper.includes("GIRIS") ||
      titleUpper.includes("SONUÇ") ||
      titleUpper.includes("SONUC")
    );
  }, [section.title]);

  const handleSaveSectionEdit = useCallback(() => {
    if (!cardState.editTitle.trim()) return;
    onUpdateSection({
      ...section,
      title: cardState.editTitle.trim(),
      description: cardState.editDescription.trim(),
    });
    updateCardState({ isEditingSection: false });
  }, [
    cardState.editTitle,
    cardState.editDescription,
    section,
    onUpdateSection,
    updateCardState,
  ]);

  const handleCancelSectionEdit = useCallback(() => {
    updateCardState({
      editTitle: section.title,
      editDescription: section.description,
      isEditingSection: false,
    });
  }, [section, updateCardState]);

  const handleAddSubSection = useCallback(() => {
    if (isSpecialSection) return;
    const newSub: OutlineSubSectionData = {
      title: `Yeni Alt Bölüm ${subSections.length + 1}`,
      description: "Alt bölüm kapsamı ve açıklaması...",
      sortOrder: subSections.length + 1,
    };
    const updatedSubs = [...subSections, newSub];
    onUpdateSection({
      ...section,
      subSections: updatedSubs,
    });
    if (!isExpanded) {
      onToggleExpand();
    }
  }, [
    isSpecialSection,
    subSections,
    section,
    onUpdateSection,
    isExpanded,
    onToggleExpand,
  ]);

  const handleDeleteSubSection = useCallback(
    (subIdx: number) => {
      const updatedSubs = subSections
        .filter((_, i) => i !== subIdx)
        .map((sub, i) => ({ ...sub, sortOrder: i + 1 }));
      onUpdateSection({
        ...section,
        subSections: updatedSubs,
      });
    },
    [subSections, section, onUpdateSection],
  );

  const handleSubDrop = useCallback(
    (targetIdx: number) => {
      if (
        cardState.draggedSubIdx === null ||
        cardState.draggedSubIdx === targetIdx
      ) {
        updateCardState({ draggedSubIdx: null, dragOverSubIdx: null });
        return;
      }

      const newSubs = [...subSections];
      const [movedItem] = newSubs.splice(cardState.draggedSubIdx, 1);
      newSubs.splice(targetIdx, 0, movedItem);

      const reordered = newSubs.map((s, i) => ({ ...s, sortOrder: i + 1 }));
      onUpdateSection({
        ...section,
        subSections: reordered,
      });

      updateCardState({ draggedSubIdx: null, dragOverSubIdx: null });
    },
    [
      cardState.draggedSubIdx,
      subSections,
      section,
      onUpdateSection,
      updateCardState,
    ],
  );

  const handleStartSubEdit = (subIdx: number) => {
    updateCardState({
      editingSubIndex: subIdx,
      subEditTitle: subSections[subIdx].title,
      subEditDescription: subSections[subIdx].description,
    });
  };

  const handleSaveSubEdit = (subIdx: number) => {
    if (!cardState.subEditTitle.trim()) return;
    const updatedSubs = subSections.map((sub, i) =>
      i === subIdx
        ? {
            ...sub,
            title: cardState.subEditTitle.trim(),
            description: cardState.subEditDescription.trim(),
          }
        : sub,
    );
    onUpdateSection({
      ...section,
      subSections: updatedSubs,
    });
    updateCardState({ editingSubIndex: null });
  };

  return {
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
  };
}

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
  } = useOutlineSectionCardLogic(props);

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
              className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-0.5 rounded transition-colors"
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
                    className="h-7 text-xs gap-1"
                  >
                    <Check className="size-3" /> Kaydet
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelSectionEdit}
                    className="h-7 text-xs gap-1"
                  >
                    <X className="size-3" /> İptal
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-semibold tracking-tight text-foreground leading-snug">
                    {section.title}
                  </h3>
                  {hasSubSections && (
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-1 rounded-full shrink-0">
                      {subSections.length} alt bölüm
                    </span>
                  )}
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
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Bölümü Düzenle"
            >
              <Pencil className="size-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleAddSubSection}
              className="size-7 text-primary hover:bg-primary/10"
              title="Alt Bölüm Ekle"
            >
              <Plus className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onDeleteSection}
              className="size-7 text-destructive hover:bg-destructive/10"
              title="Bölümü Sil"
            >
              <Trash2 className="size-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="size-7 text-muted-foreground hover:text-foreground"
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
  onUpdateCardState: (
    patch: Partial<{
      editingSubIndex: number | null;
      subEditTitle: string;
      subEditDescription: string;
      draggedSubIdx: number | null;
      dragOverSubIdx: number | null;
    }>,
  ) => void;
}

function SubSectionTreeList({
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
            className="text-xs h-7 gap-1 text-primary hover:bg-primary/10 shrink-0"
          >
            <Plus className="size-3" /> Alt Bölüm Ekle
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
              onDragEnd={(e) => {
                e.stopPropagation();
                onUpdateCardState({
                  draggedSubIdx: null,
                  dragOverSubIdx: null,
                });
              }}
              className={`group/sub relative rounded-md border bg-muted/40 p-3 transition-colors ${
                isSubDragging ? "opacity-40 border-primary" : "border-border/40"
              } ${
                isSubDragOver
                  ? "border-primary ring-1 ring-primary/20"
                  : "hover:border-primary/20"
              }`}
            >
              {isSubEditing ? (
                <div className="space-y-2">
                  <Input
                    value={subEditTitle}
                    onChange={(e) =>
                      onUpdateCardState({ subEditTitle: e.target.value })
                    }
                    placeholder="Alt bölüm başlığı..."
                    className="text-xs font-semibold"
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
                    className="textarea-academic text-xs"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onSaveSubEdit(subIdx)}
                      className="text-xs h-6 px-2 gap-1"
                    >
                      <Check className="size-3" /> Kaydet
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onUpdateCardState({ editingSubIndex: null })
                      }
                      className="text-xs h-6 px-2 gap-1"
                    >
                      <X className="size-3" /> İptal
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
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title="Düzenle"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteSubSection(subIdx)}
                      className="size-6 text-destructive hover:bg-destructive/10"
                      title="Sil"
                    >
                      <Trash2 className="size-3" />
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
