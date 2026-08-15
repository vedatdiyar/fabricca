"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check } from "lucide-react";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 gap-4 bg-card border-border">
        <DialogHeader className="space-y-1 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold px-2 py-0.5 border ${badgeColor}`}
            >
              {shortLabel}
            </Badge>
            <span className="text-xs text-muted-foreground font-sans">
              Ana Eksen Düzenleme
            </span>
          </div>
          <DialogTitle className="font-serif text-lg font-semibold text-foreground">
            Ana Araştırma Sütununu Düzenle
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Eksen Başlığı <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-sans text-sm bg-background border-border rounded-md"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Eksen Açıklaması
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="textarea-academic w-full rounded-md border-border bg-background p-3 font-sans text-xs leading-relaxed text-foreground"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between pt-3 border-t border-border/40 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            İptal
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>Kaydet</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
