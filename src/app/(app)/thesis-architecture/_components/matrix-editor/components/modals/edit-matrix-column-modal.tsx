"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HelpCircle, Copy, Check } from "lucide-react";
import { FormDialog } from "@/components/shared/dialog/form-dialog";
import type { MatrixCardDef } from "../../constants/matrix-cards";
import { countWords, copyToClipboard } from "../../utils/text-metrics";

interface EditMatrixColumnModalProps {
  open: boolean;
  card: MatrixCardDef | null;
  value: string;
  isSaving: boolean;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

/**
 * Expanded edit modal for a single matrix pillar: textarea with
 * ⌘/Ctrl + Enter quick-save, guiding questions box and save/copy actions.
 *
 * @param root0 - Component props.
 * @param root0.open - Whether the dialog is visible.
 * @param root0.card - The matrix column definition being edited or null.
 * @param root0.value - The current temporary textarea value.
 * @param root0.isSaving - Whether the persistence request is in flight.
 * @param root0.onValueChange - Updates the temporary textarea value.
 * @param root0.onClose - Dialog close handler.
 * @param root0.onSave - Persists the edited value through the values hook.
 */
export function EditMatrixColumnModal({
  open,
  card,
  value,
  isSaving,
  onValueChange,
  onClose,
  onSave,
}: EditMatrixColumnModalProps) {
  if (!card) return null;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={card.title}
      description={card.description}
      badge={{ label: card.badgeLabel, className: card.badgeColor }}
      subtitle="Düzenleme Modu"
      headerClassName="space-y-1.5"
      size="3xl"
      scrollable
      isSaving={isSaving}
      saveLabel="Kaydet"
      saveIcon={Check}
      onSave={onSave}
      cancelLabel="Kapat"
      footerExtra={
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(value, card.title)}
          className="text-xs gap-1.5 border-border/80"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>Kopyala</span>
        </Button>
      }
      footerLayout="spread"
    >

        {/* Guide questions in modal */}
        <div className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <HelpCircle className="size-3.5 text-primary" />
            <span>Bu Sütunu Yapılandırırken Dikkat Edilecek Hususlar:</span>
          </p>
          <div className="space-y-1 pl-5">
            {card.guidingQuestions.map((q, idx) => (
              <p
                key={`guide-${idx}-${q.slice(0, 10)}`}
                className="text-xs text-muted-foreground list-item"
              >
                {q}
              </p>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 min-h-[300px] flex flex-col space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onSave();
              }
            }}
            rows={14}
            className="flex-1 w-full p-4 font-sans text-sm leading-relaxed resize-none"
            placeholder={card.placeholder}
          />
          <div className="flex items-center justify-end text-xs text-muted-foreground px-1">
            <span>
              {countWords(value)} kelime • {value.length} karakter
            </span>
          </div>
        </div>
    </FormDialog>
  );
}
