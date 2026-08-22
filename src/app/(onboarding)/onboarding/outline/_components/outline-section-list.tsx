"use client";

import {
  OutlineSectionCard,
  type OutlineSectionData,
} from "./outline-section-card";

interface OutlineSectionListProps {
  sections: OutlineSectionData[];
  expandedIndices: Set<number>;
  draggedSectionIndex: number | null;
  dragOverSectionIndex: number | null;
  onToggleSectionExpand: (idx: number) => void;
  onUpdateSection: (idx: number, updated: OutlineSectionData) => void;
  onDeleteSection: (idx: number) => void;
  onDragStartSection: (idx: number) => void;
  onDragOverSection: (idx: number) => void;
  onDropSection: (targetIdx: number) => void;
  onDragEndSection: () => void;
}

/**
 * Renders a list of outline sections with expand and drag-and-drop support.
 *
 * @param props - Component props.
 * @returns Rendered section list markup.
 */
export function OutlineSectionList({
  sections,
  expandedIndices,
  draggedSectionIndex,
  dragOverSectionIndex,
  onToggleSectionExpand,
  onUpdateSection,
  onDeleteSection,
  onDragStartSection,
  onDragOverSection,
  onDropSection,
  onDragEndSection,
}: OutlineSectionListProps) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section, idx) => (
        <OutlineSectionCard
          key={`${section.title}-${idx}`}
          section={section}
          sectionIndex={idx}
          isExpanded={expandedIndices.has(idx)}
          onToggleExpand={() => onToggleSectionExpand(idx)}
          onUpdateSection={(updated) => onUpdateSection(idx, updated)}
          onDeleteSection={() => onDeleteSection(idx)}
          onDragStartSection={onDragStartSection}
          onDragOverSection={onDragOverSection}
          onDropSection={onDropSection}
          onDragEndSection={onDragEndSection}
          isDraggingSection={draggedSectionIndex === idx}
          isDragOverSection={dragOverSectionIndex === idx}
        />
      ))}
    </div>
  );
}
