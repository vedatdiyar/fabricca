"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, Hash, X, Sparkles } from "lucide-react";
import { FormDialog } from "@/components/shared/dialog/form-dialog";
import { QUADRANTS } from "../../constants/quadrant-config";
import type { BoxWithRelations } from "../../constants/quadrant-config";
import { useConceptTags } from "../../hooks/use-concept-tags";
import type { SubBoxFormData } from "../../hooks/use-box-modals";

interface EditSubBoxModalProps {
  open: boolean;
  box: BoxWithRelations;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: SubBoxFormData) => Promise<boolean> | void;
}

/** Edit modal for an existing sub-box: owns its own form state and tag controller. */
export function EditSubBoxModal({
  open,
  box,
  isSaving,
  onOpenChange,
  onSave,
}: EditSubBoxModalProps) {
  const [title, setTitle] = useState(box.title);
  const [description, setDescription] = useState(box.description ?? "");
  const [semanticQuery, setSemanticQuery] = useState(box.semanticQuery ?? "");
  const {
    concepts,
    inputValue,
    setInputValue,
    addConcept,
    removeConcept,
    handleInputKeyDown,
  } = useConceptTags(Array.isArray(box.concepts) ? [...box.concepts] : []);

  const badgeColor =
    QUADRANTS[box.boxType ?? ""]?.badgeColor ?? "border-border";
  const shortLabel = QUADRANTS[box.boxType ?? ""]?.shortLabel ?? "Alt Konu";

  const handleSave = () => {
    void onSave({
      title,
      description,
      concepts,
      semanticQuery,
    });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={box.title}
      description="Tezinizin bu tematik alt havuzuna ait başlık, açıklama ve kavram etiketlerini güncelleyin."
      badge={{ label: shortLabel, className: badgeColor }}
      subtitle="Alt Konu Düzenleme"
      size="xl"
      scrollable
      isSaving={isSaving}
      saveLabel="Kaydet"
      saveIcon={Check}
      onSave={handleSave}
      footerLayout="spread"
    >
          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Alt Konu Başlığı <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: 1990'lar Dönemi Kurumsal Politika ve Söylem Mücadelesi"
              className="font-sans"
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
              rows={4}
              placeholder="Bu alt konunun incelediği teorik veya ampirik sınırları detaylandırın..."
              className="w-full p-3 font-sans text-xs leading-relaxed"
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
                <span className="text-xs text-muted-foreground italic">
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
                  placeholder="Yeni kavram ekle (Örn: Politika Transferi, Talep Tipolojisi)..."
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
              placeholder="Örn: institutional change path dependency governance actor strategies"
              className="font-sans text-xs bg-background border-border rounded-md"
            />
            <p className="text-[10px] font-sans text-muted-foreground">
              Bu sorgu, Fabricca&apos;nın otomatik literatür genişletme ve RAG
              motoru tarafından akademik makale taramalarında kullanılır.
            </p>
          </div>
    </FormDialog>
  );
}
