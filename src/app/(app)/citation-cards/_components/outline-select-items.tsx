import { Ban, Folder, CornerDownRight } from "lucide-react";
import { SelectItem, SelectLabel, SelectGroup } from "@/components/ui/select";
import type { OutlineItem } from "../_lib/types";

interface OutlineSelectItemsProps {
  outlines: OutlineItem[];
  includeNoneOption?: boolean;
  noneLabel?: string;
  unassignedCount?: number;
}

/**
 * Renders hierarchical, professionally formatted SelectItem rows for Thesis Outline sections.
 * Enforces the Leaf-Node rule:
 * - Chapters WITH subsections act as non-selectable group labels (SelectLabel).
 * - Chapters WITHOUT subsections act as selectable items.
 * - Subsections are always selectable items.
 *
 * @param props - Component props.
 * @returns Array of SelectItem / SelectGroup components.
 */
export function OutlineSelectItems({
  outlines,
  includeNoneOption = true,
  noneLabel = "Bölüme Bağlanmadı (Boşta)",
  unassignedCount,
}: OutlineSelectItemsProps) {
  // 1. Separate main chapters (parentId === null) and subsections
  const mainChapters = outlines
    .filter((o) => o.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const subSections = outlines.filter((o) => o.parentId !== null);

  return (
    <>
      {includeNoneOption && (
        <SelectItem
          value="NONE"
          className="text-xs py-2 text-muted-foreground hover:text-foreground border-b border-border/40 mb-1"
        >
          <div className="flex items-center gap-2">
            <Ban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>{noneLabel}</span>
            {unassignedCount !== undefined && unassignedCount > 0 && (
              <span className="text-[10px] font-mono text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded">
                {unassignedCount} Fiş
              </span>
            )}
          </div>
        </SelectItem>
      )}

      {mainChapters.map((chapter) => {
        const chapterChildren = subSections
          .filter((sub) => sub.parentId === chapter.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const hasSubSections = chapterChildren.length > 0;

        if (hasSubSections) {
          return (
            <SelectGroup key={chapter.id} className="space-y-0.5 my-1">
              {/* Parent Chapter rendered as non-selectable Category/Group Label */}
              <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 flex items-center gap-1.5 select-none bg-muted/20 rounded-xs">
                <Folder className="h-3 w-3 text-primary/70 shrink-0" />
                <span className="truncate">{chapter.title}</span>
              </SelectLabel>

              {/* Subsections (Selectable) */}
              {chapterChildren.map((sub) => (
                <SelectItem
                  key={sub.id}
                  value={String(sub.id)}
                  className="text-xs py-1.5 pl-6 text-foreground hover:bg-muted/50 rounded-sm cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CornerDownRight className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                    <span className="truncate">{sub.title}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        }

        {
          /* Standalone Chapter without Subsections (Leaf Node: Directly Selectable) */
        }
        return (
          <div key={chapter.id} className="space-y-0.5 my-1">
            <SelectItem
              value={String(chapter.id)}
              className="text-xs py-2 font-medium text-foreground hover:bg-muted/50 rounded-sm cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{chapter.title}</span>
              </div>
            </SelectItem>
          </div>
        );
      })}

      {/* Handle orphan subsections if any exist without a parent */}
      {subSections
        .filter((sub) => !mainChapters.some((m) => m.id === sub.parentId))
        .map((orphan) => (
          <SelectItem
            key={orphan.id}
            value={String(orphan.id)}
            className="text-xs py-1.5 pl-4 text-muted-foreground hover:text-foreground"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CornerDownRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
              <span className="truncate">{orphan.title}</span>
            </div>
          </SelectItem>
        ))}
    </>
  );
}
