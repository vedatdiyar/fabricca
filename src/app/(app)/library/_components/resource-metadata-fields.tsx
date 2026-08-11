"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EditResourceFormFields } from "../_hooks/use-edit-resource-form";

interface ResourceMetadataFieldsProps {
  fields: EditResourceFormFields;
  onFieldChange: <K extends keyof EditResourceFormFields>(
    key: K,
    value: EditResourceFormFields[K],
  ) => void;
}

/**
 * Renders the editable bibliography metadata fields (title, authors, publisher,
 * publication year and DOI) of a library resource.
 *
 * @param root0 - Component props.
 * @param root0.fields - The current form field values.
 * @param root0.onFieldChange - Generic field value updater.
 * @returns The metadata field inputs markup.
 */
export function ResourceMetadataFields({
  fields,
  onFieldChange,
}: ResourceMetadataFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="edit-title" className="text-xs font-semibold">
          Eser Başlığı <span className="text-destructive">*</span>
        </Label>
        <Input
          id="edit-title"
          value={fields.title}
          onChange={(e) => onFieldChange("title", e.target.value)}
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
          value={fields.authorsText}
          onChange={(e) => onFieldChange("authorsText", e.target.value)}
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
            value={fields.publisher}
            onChange={(e) => onFieldChange("publisher", e.target.value)}
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
            value={fields.publicationYear}
            onChange={(e) =>
              onFieldChange(
                "publicationYear",
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
          value={fields.doi}
          onChange={(e) => onFieldChange("doi", e.target.value)}
          placeholder="Örn: 10.1016/j.cell.2023.01.001"
          className="text-sm bg-background font-mono text-xs"
        />
      </div>
    </>
  );
}
