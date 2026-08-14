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
export function OutlineSectionCard({
  section,
  sectionIndex,
  isExpanded,
  onToggleExpand,
  onUpdateSection,
  onDeleteSection,
  onDragStartSection,
  onDragOverSection,
  onDropSection,
  onDragEndSection,
  isDraggingSection = false,
  isDragOverSection = false,
}: OutlineSectionCardProps) {
  const [isEditingSection, setIsEditingSection] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);
  const [editDescription, setEditDescription] = useState(section.description);

  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [subEditTitle, setSubEditTitle] = useState("");
  const [subEditDescription, setSubEditDescription] = useState("");

  // Sub-section Drag and Drop state
  const [draggedSubIdx, setDraggedSubIdx] = useState<number | null>(null);
  const [dragOverSubIdx, setDragOverSubIdx] = useState<number | null>(null);

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
    if (!editTitle.trim()) return;
    onUpdateSection({
      ...section,
      title: editTitle.trim(),
      description: editDescription.trim(),
    });
    setIsEditingSection(false);
  }, [editTitle, editDescription, section, onUpdateSection]);

  const handleCancelSectionEdit = useCallback(() => {
    setEditTitle(section.title);
    setEditDescription(section.description);
    setIsEditingSection(false);
  }, [section]);

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
      if (draggedSubIdx === null || draggedSubIdx === targetIdx) {
        setDraggedSubIdx(null);
        setDragOverSubIdx(null);
        return;
      }

      const newSubs = [...subSections];
      const [movedItem] = newSubs.splice(draggedSubIdx, 1);
      newSubs.splice(targetIdx, 0, movedItem);

      const reordered = newSubs.map((s, i) => ({ ...s, sortOrder: i + 1 }));
      onUpdateSection({
        ...section,
        subSections: reordered,
      });

      setDraggedSubIdx(null);
      setDragOverSubIdx(null);
    },
    [draggedSubIdx, subSections, section, onUpdateSection],
  );

  const handleStartSubEdit = (subIdx: number) => {
    setEditingSubIndex(subIdx);
    setSubEditTitle(subSections[subIdx].title);
    setSubEditDescription(subSections[subIdx].description);
  };

  const handleSaveSubEdit = (subIdx: number) => {
    if (!subEditTitle.trim()) return;
    const updatedSubs = subSections.map((sub, i) =>
      i === subIdx
        ? {
            ...sub,
            title: subEditTitle.trim(),
            description: subEditDescription.trim(),
          }
        : sub,
    );
    onUpdateSection({
      ...section,
      subSections: updatedSubs,
    });
    setEditingSubIndex(null);
  };

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
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="font-serif text-base font-semibold"
                  placeholder="Bölüm başlığı..."
                  autoFocus
                />
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
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
              onClick={() => setIsEditingSection(true)}
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

      {/* Sub-sections tree (WITHOUT LEFT BORDER) */}
      {isExpanded && (!isSpecialSection || hasSubSections) && (
        <div className="mt-3 space-y-2">
          {subSections.length === 0 ? (
            <div className="flex items-center justify-between py-2 text-xs text-muted-foreground bg-muted/20 px-3 rounded-md border border-dashed border-border/50">
              <span>Bu bölüm için henüz alt bölüm eklenmedi.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddSubSection}
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
                    setDraggedSubIdx(subIdx);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverSubIdx(subIdx);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubDrop(subIdx);
                  }}
                  onDragEnd={(e) => {
                    e.stopPropagation();
                    setDraggedSubIdx(null);
                    setDragOverSubIdx(null);
                  }}
                  className={`group/sub relative rounded-md border bg-muted/40 p-3 transition-colors ${
                    isSubDragging
                      ? "opacity-40 border-primary"
                      : "border-border/40"
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
                        onChange={(e) => setSubEditTitle(e.target.value)}
                        placeholder="Alt bölüm başlığı..."
                        className="text-xs font-semibold"
                      />
                      <Textarea
                        value={subEditDescription}
                        onChange={(e) => setSubEditDescription(e.target.value)}
                        placeholder="Alt bölüm açıklaması..."
                        rows={2}
                        className="textarea-academic text-xs"
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSaveSubEdit(subIdx)}
                          className="text-xs h-6 px-2 gap-1"
                        >
                          <Check className="size-3" /> Kaydet
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSubIndex(null)}
                          className="text-xs h-6 px-2 gap-1"
                        >
                          <X className="size-3" /> İptal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Drag Handle & Sub-section Number */}
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
                          onClick={() => handleStartSubEdit(subIdx)}
                          className="size-6 text-muted-foreground hover:text-foreground"
                          title="Alt Bölümü Düzenle"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSubSection(subIdx)}
                          className="size-6 text-destructive hover:bg-destructive/10"
                          title="Alt Bölümü Sil"
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
      )}
    </Card>
  );
}
