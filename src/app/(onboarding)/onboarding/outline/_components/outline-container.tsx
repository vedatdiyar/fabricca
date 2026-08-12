"use client";

import { useState, useCallback, useMemo } from "react";
import { ArrowRight, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AIBanner } from "@/components/shared/ai-banner";
import { useOutlineContinue } from "../../_hooks/use-outline-continue";
import { OutlineStatsBar } from "./outline-stats-bar";
import {
  OutlineSectionCard,
  type OutlineSectionData,
} from "./outline-section-card";
import {
  saveOutlineHierarchyAction,
  regenerateAndPersistOutlineAction,
} from "../actions";

interface OutlineContainerProps {
  sections: OutlineSectionData[];
  academicField: string | null;
}

/**
 * Client wrapper component managing the thesis outline state, user edits,
 * drag-and-drop section reordering, matrix modal inspection, AI regeneration,
 * and step finalization.
 *
 * @param props - Component props.
 * @returns The outline container markup.
 */
export function OutlineContainer({
  sections: initialSections,
  academicField: initialAcademicField,
}: OutlineContainerProps) {
  const { proceedFromOutline } = useOutlineContinue();

  const [sections, setSections] =
    useState<OutlineSectionData[]>(initialSections);
  const [academicField, setAcademicField] = useState<string | null>(
    initialAcademicField,
  );
  const [confirming, setConfirming] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Drag & drop state for main sections
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(
    null,
  );
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<
    number | null
  >(null);

  // Expanded state set for main section indices
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(
    () => new Set(initialSections.map((_, i) => i)),
  );

  const totalSubSections = useMemo(() => {
    return sections.reduce(
      (acc, sec) => acc + (sec.subSections?.length ?? 0),
      0,
    );
  }, [sections]);

  const handleToggleSectionExpand = useCallback((index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleAddSection = useCallback(() => {
    const newSec: OutlineSectionData = {
      title: `Yeni Gövde Bölümü ${sections.length}`,
      description: "Bu bölümün akademik kapsamı ve amacı...",
      sortOrder: sections.length,
      subSections: [
        {
          title: "Kavramsal Çerçeve ve Analiz",
          description: "Bölümün alt konu anlatımı ve detaylandırılması.",
          sortOrder: 1,
        },
      ],
    };

    let nextSections: OutlineSectionData[];
    let insertIndex: number;

    if (sections.length > 1) {
      insertIndex = sections.length - 1; // Insert before Sonuç
      nextSections = [
        ...sections.slice(0, insertIndex),
        newSec,
        ...sections.slice(insertIndex),
      ].map((sec, i) => ({ ...sec, sortOrder: i + 1 }));
    } else {
      insertIndex = sections.length;
      nextSections = [...sections, newSec].map((sec, i) => ({
        ...sec,
        sortOrder: i + 1,
      }));
    }

    setSections(nextSections);
    setExpandedIndices((prev) => new Set([...prev, insertIndex]));
    toast.success("Yeni gövde bölümü eklendi.");
  }, [sections]);

  const handleUpdateSection = useCallback(
    (index: number, updated: OutlineSectionData) => {
      setSections((prev) => {
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    },
    [],
  );

  const handleDeleteSection = useCallback(
    (index: number) => {
      if (sections.length <= 1) {
        toast.error("Tez planında en az bir bölüm bulunmalıdır.");
        return;
      }
      setSections((prev) => {
        const next = prev
          .filter((_, i) => i !== index)
          .map((sec, i) => ({ ...sec, sortOrder: i + 1 }));
        return next;
      });
      setExpandedIndices((prev) => {
        const next = new Set<number>();
        prev.forEach((i) => {
          if (i < index) next.add(i);
          else if (i > index) next.add(i - 1);
        });
        return next;
      });
      toast.info("Bölüm silindi.");
    },
    [sections.length],
  );

  // Main Section Drag & Drop Handlers
  const handleDragStartSection = useCallback((index: number) => {
    setDraggedSectionIndex(index);
  }, []);

  const handleDragOverSection = useCallback((index: number) => {
    setDragOverSectionIndex(index);
  }, []);

  const handleDropSection = useCallback(
    (targetIndex: number) => {
      if (draggedSectionIndex === null || draggedSectionIndex === targetIndex) {
        setDraggedSectionIndex(null);
        setDragOverSectionIndex(null);
        return;
      }

      setSections((prev) => {
        const next = [...prev];
        const [moved] = next.splice(draggedSectionIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next.map((sec, i) => ({ ...sec, sortOrder: i + 1 }));
      });

      setDraggedSectionIndex(null);
      setDragOverSectionIndex(null);
    },
    [draggedSectionIndex],
  );

  const handleDragEndSection = useCallback(() => {
    setDraggedSectionIndex(null);
    setDragOverSectionIndex(null);
  }, []);

  const handleRegenerate = useCallback(async () => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    try {
      const result = await regenerateAndPersistOutlineAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setAcademicField(result.academicField);
      setSections(result.sections);
      setExpandedIndices(new Set(result.sections.map((_, i) => i)));
      toast.success("Tez planı AI tarafından yeniden oluşturuldu.");
    } finally {
      setIsRegenerating(false);
    }
  }, [isRegenerating]);

  const handleConfirm = useCallback(async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      const saveResult = await saveOutlineHierarchyAction({
        academicField,
        sections: sections.map((sec, i) => ({
          title: sec.title,
          description: sec.description,
          sortOrder: i + 1,
          subSections: (sec.subSections || []).map((sub, subIdx) => ({
            title: sub.title,
            description: sub.description,
            sortOrder: subIdx + 1,
          })),
        })),
      });

      if ("error" in saveResult) {
        toast.error(saveResult.error);
        return;
      }

      await proceedFromOutline();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  }, [confirming, academicField, sections, proceedFromOutline]);

  return (
    <div className="w-full flex flex-col gap-6">
      <AIBanner
        icon={BookOpen}
        title="Tez Planı Yapılandırıldı"
        description="Tez matrisiniz analiz edilerek tezinizin içindekiler (bölüm ve alt bölüm) yapısı oluşturuldu. Başlıkları düzenleyebilir, yeni bölüm ekleyebilir, sürükleyerek sıralamayı değiştirebilirsiniz."
      />

      <OutlineStatsBar
        academicField={academicField}
        sectionCount={sections.length}
        subSectionCount={totalSubSections}
        onAddSection={handleAddSection}
        onRegenerate={handleRegenerate}
        isRegenerating={isRegenerating}
      />

      <div className="flex flex-col gap-4">
        {sections.map((section, idx) => (
          <OutlineSectionCard
            key={`${section.title}-${idx}`}
            section={section}
            sectionIndex={idx}
            isExpanded={expandedIndices.has(idx)}
            onToggleExpand={() => handleToggleSectionExpand(idx)}
            onUpdateSection={(updated) => handleUpdateSection(idx, updated)}
            onDeleteSection={() => handleDeleteSection(idx)}
            onDragStartSection={handleDragStartSection}
            onDragOverSection={handleDragOverSection}
            onDropSection={handleDropSection}
            onDragEndSection={handleDragEndSection}
            isDraggingSection={draggedSectionIndex === idx}
            isDragOverSection={dragOverSectionIndex === idx}
          />
        ))}
      </div>

      <div className="flex justify-end pt-4 pb-8">
        <Button onClick={handleConfirm} disabled={confirming} size="lg">
          {confirming ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Onayla ve Literatür Tarama Adımına Geç
              <ArrowRight className="size-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
