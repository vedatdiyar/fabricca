"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { HelpCircle, Copy, Loader2, Check } from "lucide-react";
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 gap-4 bg-card border-border">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold px-2 py-0.5 border ${card.badgeColor}`}
            >
              Sütun #{card.number}
            </Badge>
            <span className="text-xs text-muted-foreground font-sans">
              Düzenleme Modu
            </span>
          </div>
          <DialogTitle className="font-serif text-lg font-semibold text-foreground">
            {card.title}
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            {card.description}
          </DialogDescription>
        </DialogHeader>

        {/* Guide questions in modal */}
        <div className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
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
            className="textarea-academic flex-1 w-full rounded-md border border-primary/40 bg-background/60 p-4 font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary resize-none"
            placeholder={card.placeholder}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>⌘ + Enter ile hızlı kaydet</span>
            <span>
              {countWords(value)} kelime • {value.length} karakter
            </span>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between pt-3 border-t border-border/40 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Kapat
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(value, card.title)}
              className="text-xs gap-1.5 border-border/80"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Kopyala</span>
            </Button>
            <Button
              size="sm"
              onClick={onSave}
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
