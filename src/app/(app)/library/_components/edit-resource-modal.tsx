"use client";

import React from "react";
import { X, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEditResourceForm } from "../_hooks/use-edit-resource-form";
import { BoxSelectionGrid } from "./BoxSelectionGrid";
import { ResourceMetadataFields } from "./ResourceMetadataFields";
import type { LibraryResourceItem } from "../_lib/types";

interface EditResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: LibraryResourceItem;
  onUpdateSuccess: (updatedResource: LibraryResourceItem) => void;
}

interface EditResourceFormProps {
  onClose: () => void;
  resource: LibraryResourceItem;
  onUpdateSuccess: (updatedResource: LibraryResourceItem) => void;
}

/**
 * Form for editing a library resource's metadata.
 *
 * @param root0 - Component props.
 * @param root0.onClose - Callback invoked when the form is closed.
 * @param root0.resource - Resource being edited.
 * @param root0.onUpdateSuccess - Callback invoked with the updated resource after a successful save.
 * @returns The edit resource form markup.
 */
function EditResourceForm({
  onClose,
  resource,
  onUpdateSuccess,
}: EditResourceFormProps) {
  const {
    formFields,
    setField,
    parentBoxes,
    selectedParentId,
    selectedSubBoxId,
    setParentId,
    setSubBoxId,
    isSubmitting,
    handleSubmit,
  } = useEditResourceForm({ resource, onClose, onUpdateSuccess });

  return (
    <Card className="max-w-xl w-full border border-border bg-card rounded-md overflow-hidden max-h-[85vh] flex flex-col">
      <div className="flex items-center justify-between border-b border-border p-5 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Pencil className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground">
              Eser Künyesini Düzenle
            </h3>
            <p className="text-xs text-muted-foreground">
              Akademik eserin başlık, yazar ve yayın bilgilerini güncelleyin.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          disabled={isSubmitting}
          className="h-8 w-8 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-6 space-y-4 overflow-y-auto flex-1"
      >
        <ResourceMetadataFields fields={formFields} onFieldChange={setField} />

        {parentBoxes.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border/40">
            <BoxSelectionGrid
              parentBoxes={parentBoxes}
              selectedParentId={selectedParentId}
              selectedSubBoxId={selectedSubBoxId}
              onParentChange={setParentId}
              onSubBoxChange={setSubBoxId}
              variant="edit"
              title="Bağlı Konu Kutusu (Box)"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            İptal
          </Button>
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={isSubmitting}
            className="gap-2 font-medium"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Güncelleniyor...
              </>
            ) : (
              "Değişiklikleri Kaydet"
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * Modal component for editing library resource metadata (title, authors, publisher, year, DOI, box).
 *
 * @param root0 - Component props.
 * @param root0.isOpen - Whether the modal is visible.
 * @param root0.onClose - Callback invoked when the modal is closed.
 * @param root0.resource - Resource being edited.
 * @param root0.onUpdateSuccess - Callback invoked with the updated resource after a successful save.
 * @returns The edit resource modal markup, or null when closed.
 */
export function EditResourceModal({
  isOpen,
  onClose,
  resource,
  onUpdateSuccess,
}: EditResourceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-0">
      <EditResourceForm
        key={`${resource.id}-${isOpen}`}
        resource={resource}
        onClose={onClose}
        onUpdateSuccess={onUpdateSuccess}
      />
    </div>
  );
}
