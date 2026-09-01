"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { FormDialog } from "@/components/shared/dialog/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QUADRANTS } from "../../constants/quadrant-config";
import type { BoxWithRelations } from "../../constants/quadrant-config";
import type { RootBoxFormData } from "../../hooks/use-box-modals";

interface EditRootBoxModalProps {
  open: boolean;
  box: BoxWithRelations;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: RootBoxFormData) => Promise<boolean> | void;
}

/** Edit modal for a root research pillar: title and description only. */
export function EditRootBoxModal({
  open,
  box,
  isSaving,
  onOpenChange,
  onSave,
}: EditRootBoxModalProps) {
  const [title, setTitle] = useState(box.title);
  const [description, setDescription] = useState(box.description ?? "");

  const badgeColor =
    QUADRANTS[box.boxType ?? ""]?.badgeColor ?? "border-border";
  const shortLabel = QUADRANTS[box.boxType ?? ""]?.shortLabel ?? "Ana Eksen";

  const handleSave = () => {
    void onSave({ title, description });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ana Araştırma Sütununu Düzenle"
      badge={{ label: shortLabel, className: `text-[10px] font-semibold px-2 py-0.5 ${badgeColor}` }}
      subtitle="Ana Eksen Düzenleme"
      size="md"
      isSaving={isSaving}
      saveLabel="Kaydet"
      saveIcon={Check}
      onSave={handleSave}
      footerLayout="spread"
    >
      <div className="space-y-1.5">
        <label className="font-sans text-xs font-medium text-foreground">
          Eksen Başlığı <span className="text-destructive">*</span>
        </label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-sans" />
      </div>

      <div className="space-y-1.5">
        <label className="font-sans text-xs font-medium text-foreground">Eksen Açıklaması</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full p-3 font-sans text-xs leading-relaxed"
        />
      </div>
    </FormDialog>
  );
}
