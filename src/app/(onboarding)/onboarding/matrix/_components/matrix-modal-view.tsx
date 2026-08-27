"use client";

import { useState, memo, useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Target,
  Compass,
  Database,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit3,
  Check,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MatrixValueMarkdown } from "@/components/shared/matrix-value-markdown";
import type { ThesisMatrix } from "@/lib/types";
import type { MatrixFieldKey } from "../_services/rubrics";

interface ModalQuadrantConfig {
  key: MatrixFieldKey;
  number: string;
  Icon: LucideIcon;
  label: string;
  shortHint: string;
}

const MODAL_QUADRANTS: ModalQuadrantConfig[] = [
  {
    key: "subjectProblem",
    number: "01",
    Icon: Target,
    label: "Araştırma Problemi, Aktörler ve Odak",
    shortHint:
      "Çözülmek istenen problem gerilimi, aktörler ve araştırma sorusu.",
  },
  {
    key: "theoreticalFramework",
    number: "02",
    Icon: Compass,
    label: "Teorik ve Kavramsal Çerçeve",
    shortHint: "Temel alınan kuram, kavramsal model veya analitik paradigma.",
  },
  {
    key: "primaryMaterial",
    number: "03",
    Icon: Database,
    label: "Veri Kaynağı / Birincil Malzeme",
    shortHint: "İncelenecek arşiv, saha verisi, belgeler veya hedef kitle.",
  },
  {
    key: "methodology",
    number: "04",
    Icon: BookOpen,
    label: "Metodoloji",
    shortHint: "Araştırma deseni, veri toplama ve analiz tekniği.",
  },
];

interface MatrixModalViewProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedField: MatrixFieldKey | null;
  matrix: Partial<ThesisMatrix>;
  onFieldChange: (field: MatrixFieldKey, value: string) => void;
}

/**
 * Focused single-quadrant inspection and direct edit dialog for the Living Thesis Matrix.
 * Displays only the selected quadrant clicked by the user.
 */
export const MatrixModalView = memo(function MatrixModalView({
  isOpen,
  onOpenChange,
  selectedField,
  matrix,
  onFieldChange,
}: MatrixModalViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const currentQuadrant = MODAL_QUADRANTS.find((q) => q.key === selectedField);
  const currentValue = selectedField
    ? (matrix[selectedField]?.trim() ?? "")
    : "";

  // Reset editing state whenever the modal or selected field changes
  useEffect(() => {
    setIsEditing(false);
    setEditValue(currentValue);
  }, [isOpen, selectedField, currentValue]);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  if (!currentQuadrant || !selectedField) return null;

  const isCompleted = currentValue.length >= 20;
  const isDiscussing = currentValue.length > 0 && !isCompleted;

  const handleStartEdit = () => {
    setEditValue(currentValue);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onFieldChange(selectedField, editValue);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(currentValue);
    setIsEditing(false);
  };

  const { number, Icon, label, shortHint } = currentQuadrant;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl flex flex-col p-5 rounded-lg border border-border bg-card">
        {/* Dialog Header */}
        <DialogHeader className="space-y-1 pb-3 border-b border-border">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center space-x-2.5">
              <div className="size-7 rounded-md border border-primary/20 bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Icon className="size-3.5" />
              </div>
              <DialogTitle className="font-serif text-base font-semibold tracking-tight text-foreground">
                <span className="font-mono text-muted-foreground mr-1.5 font-normal">
                  {number}
                </span>
                {label}
              </DialogTitle>
            </div>

            <div className="shrink-0">
              {isCompleted ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-success/10 border border-success/20 text-success">
                  <CheckCircle2 className="size-3" />
                  Mühürlendi
                </span>
              ) : isDiscussing ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-warning/10 border border-warning/20 text-warning">
                  <Clock className="size-3" />
                  Müzakerede
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                  Beklemede
                </span>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-0.5">
            {shortHint}
          </DialogDescription>
        </DialogHeader>

        {/* Selected Field Body */}
        <div className="py-3">
          <Card
            className={`p-4 rounded-lg border flex flex-col transition-all ${
              isCompleted
                ? "border-primary/20 bg-background/60"
                : isDiscussing
                  ? "border-warning/20 bg-background/60"
                  : "border-border/60 bg-background/30"
            }`}
          >
            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  ref={textareaRef}
                  rows={5}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={shortHint}
                  className="textarea-academic text-xs leading-relaxed resize-none"
                />
                <div className="flex items-center justify-end space-x-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2.5 rounded-md [&_svg]:size-3"
                    onClick={handleCancelEdit}
                  >
                    <X className="mr-1" />
                    İptal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs px-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 [&_svg]:size-3"
                    onClick={handleSaveEdit}
                  >
                    <Check className="mr-1" />
                    Kaydet
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {currentValue ? (
                      <MatrixValueMarkdown content={currentValue} />
                    ) : (
                      <p className="text-xs font-normal italic text-muted-foreground">
                        Bu kadran henüz olgunlaştırılmadı. Danışmanla sohbet
                        ettikçe otomatik işlenecektir veya aşağıdaki butona
                        tıklayarak doğrudan girebilirsiniz.
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-md shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer [&_svg]:size-3.5"
                    onClick={handleStartEdit}
                    title="Düzenle"
                  >
                    <Edit3 />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Dialog Footer */}
        <div className="pt-2 border-t border-border flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs px-3 rounded-md text-muted-foreground hover:text-foreground"
          >
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
