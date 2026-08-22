"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIBanner } from "@/components/shared/ai-banner";
import { OutlineStatsBar } from "./outline-stats-bar";
import { type OutlineSectionData } from "./outline-section-card";
import { OutlineSectionList } from "./outline-section-list";
import { useOutlineEditor } from "../_hooks/use-outline-editor";

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
  sections,
  academicField,
}: OutlineContainerProps) {
  const { bfcacheId } = useRouter();

  return (
    <OutlineEditor
      key={bfcacheId}
      sections={sections}
      academicField={academicField}
    />
  );
}

function OutlineEditor({
  sections: initialSections,
  academicField: initialAcademicField,
}: OutlineContainerProps) {
  const {
    sections,
    academicField,
    totalSubSections,
    expandedIndices,
    draggedSectionIndex,
    dragOverSectionIndex,
    confirming,
    isRegenerating,
    handleToggleSectionExpand,
    handleAddSection,
    handleUpdateSection,
    handleDeleteSection,
    handleDragStartSection,
    handleDragOverSection,
    handleDropSection,
    handleDragEndSection,
    handleRegenerate,
    handleConfirm,
  } = useOutlineEditor(initialSections, initialAcademicField);

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

      <OutlineSectionList
        sections={sections}
        expandedIndices={expandedIndices}
        draggedSectionIndex={draggedSectionIndex}
        dragOverSectionIndex={dragOverSectionIndex}
        onToggleSectionExpand={handleToggleSectionExpand}
        onUpdateSection={handleUpdateSection}
        onDeleteSection={handleDeleteSection}
        onDragStartSection={handleDragStartSection}
        onDragOverSection={handleDragOverSection}
        onDropSection={handleDropSection}
        onDragEndSection={handleDragEndSection}
      />

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
