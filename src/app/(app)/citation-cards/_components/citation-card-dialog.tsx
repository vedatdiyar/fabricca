"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CitationCardView } from "./citation-card-view";
import { CitationCardForm } from "./citation-card-form";
import type {
  CitationCardItem,
  BoxItem,
  SourceItem,
  OutlineItem,
} from "../_lib/types";

/** Props for CitationCardDialog. */
export interface CitationCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardToEdit?: CitationCardItem | null;
  mode: "view" | "edit";
  sources: SourceItem[];
  boxes: BoxItem[];
  outlines: OutlineItem[];
  onSave: (
    card: Omit<CitationCardItem, "id" | "createdAt" | "updatedAt"> & {
      id?: number;
    },
  ) => void;
}

/**
 * Dialog component for creating a new citation card, editing an existing card,
 * or viewing an existing card in read-only mode.
 *
 * @param props - Dialog visibility state, items, and save callback.
 * @returns Dialog markup.
 */
export function CitationCardDialog(props: CitationCardDialogProps) {
  const {
    open,
    onOpenChange,
    cardToEdit,
    mode,
    sources,
    boxes,
    outlines,
    onSave,
  } = props;

  const preventViewAutofocus = Boolean(cardToEdit) && mode === "view";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl sm:max-w-3xl p-6 rounded-md border-border bg-background"
        onOpenAutoFocus={
          preventViewAutofocus ? (e) => e.preventDefault() : undefined
        }
      >
        {open && (
          <DialogBody
            key={`${cardToEdit?.id ?? "new"}-${mode}`}
            cardToEdit={cardToEdit}
            mode={mode}
            sources={sources}
            boxes={boxes}
            outlines={outlines}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Props for the dialog body that owns the view/edit toggle state. */
interface DialogBodyProps {
  cardToEdit?: CitationCardItem | null;
  mode: "view" | "edit";
  sources: SourceItem[];
  boxes: BoxItem[];
  outlines: OutlineItem[];
  onSave: (
    card: Omit<CitationCardItem, "id" | "createdAt" | "updatedAt"> & {
      id?: number;
    },
  ) => void;
  onClose: () => void;
}

/**
 * Holds the internal view/edit state of the citation card dialog and renders
 * the read-only view or the editable form accordingly.
 *
 * @param props - Dialog body props.
 * @returns Either the read-only view or the edit form markup.
 */
function DialogBody(props: DialogBodyProps) {
  const { cardToEdit, mode, sources, boxes, outlines, onSave, onClose } =
    props;
  const [isEditing, setIsEditing] = useState(mode === "edit");

  const isNewCard = !cardToEdit;
  const title = isNewCard
    ? "Yeni Alıntı Fişi Oluştur"
    : isEditing
      ? "Alıntı Fişini Düzenle"
      : "Alıntı Fişi Detayı";

  return (
    <div className="space-y-4">
      <DialogHeader className="space-y-1 text-left pb-2 border-b border-border">
        <DialogTitle className="font-serif text-xl font-bold tracking-tight text-foreground">
          {title}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          {isNewCard || isEditing
            ? "Kaynaklardan derlediğiniz doğrudan alıntı, açımlama veya kişisel değerlendirme notlarınızı düzenleyin."
            : "Akademik kaynak, konu kutusu ve tez iskeleti ile ilişkilendirilmiş alıntı fişi detayları."}
        </DialogDescription>
      </DialogHeader>

      {cardToEdit && !isEditing ? (
        <CitationCardView
          card={cardToEdit}
          onEdit={() => setIsEditing(true)}
          onClose={onClose}
        />
      ) : (
        <CitationCardForm
          cardToEdit={cardToEdit}
          sources={sources}
          boxes={boxes}
          outlines={outlines}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </div>
  );
}
