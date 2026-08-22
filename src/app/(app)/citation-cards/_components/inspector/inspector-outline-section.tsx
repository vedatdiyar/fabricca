"use client";

import { FolderTree } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OutlineSelectItems } from "../outline-select-items";
import type { OutlineItem } from "../../_lib/types";

interface InspectorOutlineSectionProps {
  currentOutlineId: number | null;
  outlines: OutlineItem[];
  isUpdatingOutline: boolean;
  onOutlineChange: (val: string) => void;
}

export function InspectorOutlineSection({
  currentOutlineId,
  outlines,
  isUpdatingOutline,
  onOutlineChange,
}: InspectorOutlineSectionProps) {
  return (
    <div className="space-y-1.5 p-3 rounded-md bg-muted/30 border border-border">
      <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <FolderTree className="h-3.5 w-3.5 text-primary" />
          Tez İskeleti / Bölüm Bağı
        </span>
        {isUpdatingOutline && (
          <span className="text-[10px] font-mono text-primary animate-pulse">
            Güncelleniyor...
          </span>
        )}
      </label>

      <Select
        value={currentOutlineId !== null ? String(currentOutlineId) : "NONE"}
        onValueChange={onOutlineChange}
      >
        <SelectTrigger
          disabled={isUpdatingOutline}
          className="w-full text-xs bg-background border-border font-medium cursor-pointer"
        >
          <SelectValue placeholder="Bölüm Seçin" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <OutlineSelectItems
            outlines={outlines}
            includeNoneOption={true}
            noneLabel="Bölüme Bağlanmadı (Boşta)"
          />
        </SelectContent>
      </Select>
    </div>
  );
}
