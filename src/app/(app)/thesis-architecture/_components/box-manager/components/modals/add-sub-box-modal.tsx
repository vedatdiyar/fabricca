"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, Hash, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUADRANTS } from "../../constants/quadrant-config";
import type { BoxWithRelations } from "../../constants/quadrant-config";
import { useConceptTags } from "../../hooks/use-concept-tags";
import type { SubBoxFormData } from "../../hooks/use-box-modals";

interface AddSubBoxModalProps {
  open: boolean;
  rootBoxes: BoxWithRelations[];
  parentId: number | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onParentIdChange: (id: number) => void;
  onSave: (data: SubBoxFormData) => Promise<boolean> | void;
}

/** Add modal for a new sub-box: quadrant selection, form fields and tag controller. */
export function AddSubBoxModal({
  open,
  rootBoxes,
  parentId,
  isSaving,
  onOpenChange,
  onParentIdChange,
  onSave,
}: AddSubBoxModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [semanticQuery, setSemanticQuery] = useState("");
  const {
    concepts,
    inputValue,
    setInputValue,
    addConcept,
    removeConcept,
    handleInputKeyDown,
  } = useConceptTags();

  const handleSave = () => {
    void onSave({
      title,
      description,
      concepts,
      semanticQuery,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 gap-4 bg-card border-border">
        <DialogHeader className="space-y-1 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border border-primary/20 bg-primary/10 text-primary"
            >
              Yeni Konu Havuzu
            </Badge>
            <span className="text-xs text-muted-foreground font-sans">
              Alt Konu Ekle
            </span>
          </div>
          <DialogTitle className="font-serif text-base font-semibold text-foreground">
            Yeni Alt Konu Tanımla
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            Tezinizin araştırma mimarisine yeni bir tematik alt konu ve kavram
            havuzu ekleyin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Quadrant Selector */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Ana Araştırma Ekseni <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rootBoxes.map((root) => {
                const isSelected = parentId === root.id;
                const config = QUADRANTS[root.boxType ?? ""];
                return (
                  <div
                    key={root.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onParentIdChange(root.id)}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") &&
                      onParentIdChange(root.id)
                    }
                    className={cn(
                      "flex items-center gap-2.5 p-2.5 rounded-md border text-left cursor-pointer transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 text-foreground shadow-2xs ring-1 ring-primary/30"
                        : "border-border/60 bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:border-border",
                    )}
                  >
                    <div
                      className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0",
                        isSelected ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate text-foreground">
                        {root.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {config?.label ?? root.boxType}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Alt Konu Başlığı <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Karşılaştırmalı Anayasa Mahkemesi Kararları Analizi"
              className="font-sans bg-background border-border rounded-md"
            />
          </div>

          {/* Description Textarea */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Akademik Açıklama ve Kapsam
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Bu alt konunun araştırma problemiyle ilişkisini ve kapsamını yazın..."
              className="textarea-academic w-full rounded-md border-border bg-background p-3 font-sans text-xs leading-relaxed text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Concept Tag Management */}
          <div className="space-y-2">
            <label className="font-sans text-xs font-medium text-foreground flex items-center justify-between">
              <span>Kavram ve Anahtar Kelime Etiketleri</span>
              <span className="text-[10px] text-muted-foreground">
                ({concepts.length} etiket)
              </span>
            </label>

            {/* Concept Chips List */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-md border border-border/60 bg-muted/20 items-center">
              {concepts.length > 0 ? (
                concepts.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1.5 border border-border/60 bg-card px-2.5 py-1 font-sans text-[10px] text-foreground"
                  >
                    <Hash className="h-3 w-3 text-primary" />
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeConcept(tag)}
                      className="text-muted-foreground hover:text-destructive ml-0.5"
                      title="Etiketi kaldır"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground/60 italic">
                  Henüz kavram etiketi eklenmedi.
                </span>
              )}
            </div>

            {/* Tag Input Form */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Yeni kavram ekle..."
                  className="pl-8 h-8 text-xs font-sans bg-background border-border rounded-md"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => addConcept()}
                className="h-8 px-3 text-xs"
              >
                Ekle
              </Button>
            </div>
          </div>

          {/* Semantic Search Query */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>RAG & Literatür Arama Sorgusu (İsteğe Bağlı)</span>
            </label>
            <Input
              value={semanticQuery}
              onChange={(e) => setSemanticQuery(e.target.value)}
              placeholder="Örn: Constitutional court party bans closure cases legal analysis"
              className="font-sans text-xs bg-background border-border rounded-md"
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
            <span>Alt Konuyu Oluştur</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
