"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { BoxSelectionGrid } from "./BoxSelectionGrid";
import type { LibraryParentBoxOption } from "../_actions/box-actions";

interface AddResourceBoxSelectorProps {
  parentBoxes: LibraryParentBoxOption[];
  isLoading: boolean;
  hierarchyError: string | null;
  selectedParentId: number | null;
  selectedSubBoxId: number | null;
  onParentSelect: (parentId: number) => void;
  onSubBoxSelect: (subBoxId: number | null) => void;
  disabled?: boolean;
}

/**
 * Topic box selection section for the add-resource modal, including the loading,
 * error and empty states above the shared box selection grid.
 *
 * @param root0 - Component props.
 * @param root0.parentBoxes - The loaded parent box hierarchy.
 * @param root0.isLoading - Whether the hierarchy is still loading.
 * @param root0.hierarchyError - Hierarchy load error message, if any.
 * @param root0.selectedParentId - Currently selected parent box id.
 * @param root0.selectedSubBoxId - Currently selected sub-box id.
 * @param root0.onParentSelect - Callback invoked when a parent box is selected.
 * @param root0.onSubBoxSelect - Callback invoked when a sub-box is selected.
 * @param root0.disabled - Whether the controls are disabled while submitting.
 * @returns The add-resource box selector markup.
 */
export function AddResourceBoxSelector({
  parentBoxes,
  isLoading,
  hierarchyError,
  selectedParentId,
  selectedSubBoxId,
  onParentSelect,
  onSubBoxSelect,
  disabled = false,
}: AddResourceBoxSelectorProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-foreground font-medium">Konu Kutusu</Label>
      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Kutular yükleniyor...
        </div>
      ) : hierarchyError ? (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/20 border border-border text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {hierarchyError}
        </div>
      ) : parentBoxes.length === 0 ? (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/20 border border-border text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Henüz tanımlı bir konu kutunuz bulunmuyor. Lütfen onboarding
          adımlarını tamamlayın.
        </div>
      ) : (
        <BoxSelectionGrid
          parentBoxes={parentBoxes}
          selectedParentId={selectedParentId}
          selectedSubBoxId={selectedSubBoxId}
          onParentChange={onParentSelect}
          onSubBoxChange={onSubBoxSelect}
          disabled={disabled}
          variant="add"
        />
      )}
    </div>
  );
}
