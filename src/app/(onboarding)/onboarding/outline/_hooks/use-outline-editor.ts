"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useOutlineContinue } from "../../_hooks/use-outline-continue";
import { type OutlineSectionData } from "../_components/outline-section-card";
import {
  saveOutlineHierarchyAction,
  regenerateAndPersistOutlineAction,
} from "../actions";

/**
 * Manages thesis outline editor state, drag-and-drop, AI regeneration and persistence.
 *
 * @param initialSections - Initial outline sections.
 * @param initialAcademicField - Initial academic field value.
 * @returns Editor state and handlers.
 */
export function useOutlineEditor(
  initialSections: OutlineSectionData[],
  initialAcademicField: string | null,
) {
  const { proceedFromOutline } = useOutlineContinue();

  const [containerState, setContainerState] = useState({
    sections: initialSections,
    academicField: initialAcademicField,
    confirming: false,
    isRegenerating: false,
    draggedSectionIndex: null as number | null,
    dragOverSectionIndex: null as number | null,
  });

  const {
    sections,
    academicField,
    confirming,
    isRegenerating,
    draggedSectionIndex,
    dragOverSectionIndex,
  } = containerState;

  const setSections = useCallback(
    (
      val:
        | OutlineSectionData[]
        | ((prev: OutlineSectionData[]) => OutlineSectionData[]),
    ) => {
      setContainerState((prev) => ({
        ...prev,
        sections: typeof val === "function" ? val(prev.sections) : val,
      }));
    },
    [],
  );

  const setAcademicField = useCallback((val: string | null) => {
    setContainerState((prev) => ({ ...prev, academicField: val }));
  }, []);

  const setConfirming = useCallback((val: boolean) => {
    setContainerState((prev) => ({ ...prev, confirming: val }));
  }, []);

  const setIsRegenerating = useCallback((val: boolean) => {
    setContainerState((prev) => ({ ...prev, isRegenerating: val }));
  }, []);

  const setDraggedSectionIndex = useCallback((val: number | null) => {
    setContainerState((prev) => ({ ...prev, draggedSectionIndex: val }));
  }, []);

  const setDragOverSectionIndex = useCallback((val: number | null) => {
    setContainerState((prev) => ({ ...prev, dragOverSectionIndex: val }));
  }, []);

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
      insertIndex = sections.length - 1;
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
  }, [sections, setSections]);

  const handleUpdateSection = useCallback(
    (index: number, updated: OutlineSectionData) => {
      setSections((prev) => {
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    },
    [setSections],
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
    [sections.length, setSections],
  );

  const handleDragStartSection = useCallback(
    (index: number) => {
      setDraggedSectionIndex(index);
    },
    [setDraggedSectionIndex],
  );

  const handleDragOverSection = useCallback(
    (index: number) => {
      setDragOverSectionIndex(index);
    },
    [setDragOverSectionIndex],
  );

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
    [
      draggedSectionIndex,
      setDraggedSectionIndex,
      setDragOverSectionIndex,
      setSections,
    ],
  );

  const handleDragEndSection = useCallback(() => {
    setDraggedSectionIndex(null);
    setDragOverSectionIndex(null);
  }, [setDraggedSectionIndex, setDragOverSectionIndex]);

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
  }, [isRegenerating, setIsRegenerating, setAcademicField, setSections]);

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
  }, [confirming, setConfirming, academicField, sections, proceedFromOutline]);

  return {
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
  };
}
