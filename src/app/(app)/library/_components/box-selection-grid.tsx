"use client";

import { Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LibraryParentBoxOption } from "../box-actions";

interface BoxSelectionGridProps {
  parentBoxes: LibraryParentBoxOption[];
  selectedParentId: number | null;
  selectedSubBoxId: number | null;
  onParentChange: (parentId: number) => void;
  onSubBoxChange: (subBoxId: number | null) => void;
  disabled?: boolean;
  /** Visual variant matching the owning modal (edit vs add flow). */
  variant?: "edit" | "add";
  /** When set, renders the leading header row (Sparkles + title). */
  title?: string;
}

/**
 * Shared hierarchical thesis-box selector: a grid of parent boxes and, for the
 * edit flow, the native sub-box dropdown for the selected parent.
 *
 * @param root0 - Component props.
 * @param root0.parentBoxes - The loaded parent box hierarchy.
 * @param root0.selectedParentId - Currently selected parent box id.
 * @param root0.selectedSubBoxId - Currently selected sub-box id.
 * @param root0.onParentChange - Callback invoked when a parent box is selected.
 * @param root0.onSubBoxChange - Callback invoked when a sub-box is selected.
 * @param root0.disabled - Whether the controls are disabled while submitting.
 * @param root0.variant - Presentation variant (edit uses a native select).
 * @param root0.title - Optional header title row label.
 * @returns The box selection grid markup.
 */
export function BoxSelectionGrid({
  parentBoxes,
  selectedParentId,
  selectedSubBoxId,
  onParentChange,
  onSubBoxChange,
  disabled = false,
  variant = "edit",
  title,
}: BoxSelectionGridProps) {
  const selectedParent =
    parentBoxes.find((b) => b.id === selectedParentId) ?? null;
  const hasSubBoxes = !!selectedParent && selectedParent.children.length > 0;

  const parentButtonClass = (isSelected: boolean) =>
    variant === "add"
      ? cn(
          "px-3 py-2 text-xs rounded-md border text-left",
          isSelected
            ? "font-semibold border-primary/20 bg-accent/20 text-foreground"
            : "font-medium border-border bg-background text-muted-foreground hover:bg-muted",
        )
      : cn(
          "text-left text-xs transition-all p-2 rounded-md border",
          isSelected
            ? "border-2 border-primary bg-primary/10 font-semibold text-foreground"
            : "border border-border/40 bg-background hover:bg-muted/20 font-normal text-muted-foreground",
        );

  return (
    <>
      {title && (
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <Label className="text-xs font-semibold text-foreground">
            {title}
          </Label>
        </div>
      )}

      <div
        className={cn("grid grid-cols-2 gap-2", variant === "add" && "pt-1")}
      >
        {parentBoxes.map((parent) => {
          const isSelected = selectedParentId === parent.id;
          return (
            <button
              key={parent.id}
              type="button"
              disabled={variant === "add" ? disabled : undefined}
              onClick={() => onParentChange(parent.id)}
              className={parentButtonClass(isSelected)}
            >
              {parent.title}
            </button>
          );
        })}
      </div>

      {variant === "edit" && hasSubBoxes && selectedParent && (
        <div className="space-y-2 pt-1">
          <Label className="text-xs font-medium text-muted-foreground">
            Alt Konu Kutusu:
          </Label>
          <Select
            value={selectedSubBoxId ? String(selectedSubBoxId) : ""}
            onValueChange={(v) => onSubBoxChange(v ? parseInt(v, 10) : null)}
          >
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Alt kutu seçin" />
            </SelectTrigger>
            <SelectContent>
              {selectedParent.children.map((sub) => (
                <SelectItem key={sub.id} value={String(sub.id)}>
                  {sub.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}
