"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  getBoxHierarchyForLibraryAction,
  updateLibraryResourceAction,
} from "../actions";
import type { LibraryParentBoxOption } from "../_actions/box-actions";
import type { LibraryResourceItem } from "../_types/types";

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
  const [title, setTitle] = useState(resource.title);
  const [authorsText, setAuthorsText] = useState(resource.authors.join(", "));
  const [publisher, setPublisher] = useState(resource.publisher || "");
  const [publicationYear, setPublicationYear] = useState<number | "">(
    resource.publicationYear ?? "",
  );
  const [doi, setDoi] = useState(resource.doi || "");

  const [hierarchy, setHierarchy] = useState<LibraryParentBoxOption[] | null>(
    null,
  );
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [selectedSubBoxId, setSelectedSubBoxId] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /**
     * Loads the parent box hierarchy and restores the resource's box selection.
     */
    async function loadHierarchy() {
      const res = await getBoxHierarchyForLibraryAction();
      if (cancelled) return;

      if (res.success) {
        setHierarchy(res.data);

        let foundParent: LibraryParentBoxOption | undefined;
        let foundSubId: number | null = null;

        if (resource.subBoxId) {
          foundParent = res.data.find((p) =>
            p.children.some((c) => c.id === resource.subBoxId),
          );
          if (foundParent) {
            foundSubId = resource.subBoxId;
          }
        }

        if (!foundParent) {
          foundParent = res.data.find((p) => p.boxType === resource.boxType);
        }

        if (foundParent) {
          setSelectedParentId(foundParent.id);
          setSelectedSubBoxId(
            foundSubId ??
              (foundParent.children.length > 0
                ? foundParent.children[0].id
                : null),
          );
        } else if (res.data.length > 0) {
          setSelectedParentId(res.data[0].id);
          setSelectedSubBoxId(
            res.data[0].children.length > 0 ? res.data[0].children[0].id : null,
          );
        }
      }
    }

    loadHierarchy();

    return () => {
      cancelled = true;
    };
  }, [resource]);

  const parentBoxes = hierarchy ?? [];
  const selectedParent =
    parentBoxes.find((b) => b.id === selectedParentId) ?? null;
  const hasSubBoxes = !!selectedParent && selectedParent.children.length > 0;

  const handleParentChange = (parentId: number) => {
    setSelectedParentId(parentId);
    const parent = parentBoxes.find((b) => b.id === parentId);
    setSelectedSubBoxId(
      parent && parent.children.length > 0 ? parent.children[0].id : null,
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Lütfen eser başlığını giriniz.");
      return;
    }

    const parsedAuthors = authorsText
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    if (parsedAuthors.length === 0) {
      toast.error("Lütfen en az bir yazar adı giriniz.");
      return;
    }

    const targetBoxId =
      hasSubBoxes && selectedSubBoxId !== null
        ? selectedSubBoxId
        : (selectedParentId ?? undefined);

    try {
      setIsSubmitting(true);

      const res = await updateLibraryResourceAction({
        resourceId: resource.id,
        title: title.trim(),
        authors: parsedAuthors,
        publisher: publisher.trim() || undefined,
        publicationYear:
          typeof publicationYear === "number" ? publicationYear : null,
        doi: doi.trim() || undefined,
        boxId: targetBoxId,
      });

      if (res.success && res.data) {
        onUpdateSuccess(res.data);
        toast.success("Eser metadataları başarıyla güncellendi.");
        onClose();
      } else {
        toast.error(res.error || "Eser güncellenirken hata oluştu.");
      }
    } catch {
      toast.error("İşlem gerçekleştirilirken beklenmeyen bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-xl w-full border border-border bg-card shadow-2xl rounded-xl overflow-hidden max-h-[90vh] flex flex-col">
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
        <div className="space-y-1.5">
          <Label htmlFor="edit-title" className="text-xs font-semibold">
            Eser Başlığı <span className="text-destructive">*</span>
          </Label>
          <Input
            id="edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Eserin tam akademik başlığı..."
            required
            className="text-sm bg-background"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-authors" className="text-xs font-semibold">
            Yazarlar <span className="text-destructive">*</span>
            <span className="text-xs font-normal text-muted-foreground ml-1">
              (Virgülle ayırarak giriniz)
            </span>
          </Label>
          <Input
            id="edit-authors"
            value={authorsText}
            onChange={(e) => setAuthorsText(e.target.value)}
            placeholder="Örn: Ahmet Yılmaz, Ayşe Demir"
            required
            className="text-sm bg-background"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-publisher" className="text-xs font-semibold">
              Yayıncı / Dergi / Mecra
            </Label>
            <Input
              id="edit-publisher"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="Örn: Cambridge University Press"
              className="text-sm bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-year" className="text-xs font-semibold">
              Yayın Yılı <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-year"
              type="number"
              value={publicationYear}
              onChange={(e) =>
                setPublicationYear(
                  e.target.value ? parseInt(e.target.value, 10) : "",
                )
              }
              placeholder="Örn: 2024"
              required
              className="text-sm bg-background"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-doi" className="text-xs font-semibold">
            DOI (Digital Object Identifier)
          </Label>
          <Input
            id="edit-doi"
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="Örn: 10.1016/j.cell.2023.01.001"
            className="text-sm bg-background font-mono text-xs"
          />
        </div>

        {parentBoxes.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <Label className="text-xs font-semibold text-foreground">
                Bağlı Konu Kutusu (Box)
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {parentBoxes.map((parent) => {
                const isSelected = selectedParentId === parent.id;
                return (
                  <button
                    key={parent.id}
                    type="button"
                    onClick={() => handleParentChange(parent.id)}
                    className={
                      isSelected
                        ? "p-2.5 rounded-lg border-2 border-primary bg-primary/5 text-left text-xs font-semibold text-foreground shadow-sm transition-all"
                        : "p-2.5 rounded-lg border border-border/60 bg-background hover:bg-muted/40 text-left text-xs font-normal text-muted-foreground transition-all"
                    }
                  >
                    {parent.title}
                  </button>
                );
              })}
            </div>

            {hasSubBoxes && selectedParent && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Alt Konu Kutusu:
                </Label>
                <select
                  value={selectedSubBoxId ?? ""}
                  onChange={(e) =>
                    setSelectedSubBoxId(
                      e.target.value ? parseInt(e.target.value, 10) : null,
                    )
                  }
                  className="w-full h-9 rounded-md border border-border bg-background px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {selectedParent.children.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
