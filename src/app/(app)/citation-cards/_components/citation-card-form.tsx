"use client";

import {
  MessageSquareQuote,
  BookOpen,
  FolderTree,
  Folder,
  CornerDownRight,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { cn } from "@/lib/utils";
import { NOTE_TYPE_DISPLAY_LABELS } from "../_lib/note-type-labels";
import { OutlineSelectItems } from "./outline-select-items";
import {
  useCitationCardForm,
  type CitationCardFormProps,
} from "../_hooks/use-citation-card-form";
import type { CitationNoteType } from "../_lib/types";

export type { CitationCardFormProps } from "../_hooks/use-citation-card-form";
export { NOTE_TYPE_DISPLAY_LABELS } from "../_lib/note-type-labels";

/**
 * Form handling inputs and state for card creation/editing.
 * Features clean hierarchical thesis section selection and auto-derived box context.
 *
 * @param props - Form props.
 * @returns Form markup.
 */
export function CitationCardForm(props: CitationCardFormProps) {
  const { sources, outlines, onClose } = props;
  const {
    formFields,
    setField,
    selectedSourceObj,
    selectedBoxObj,
    selectedOutlineObj,
    handleSubmit,
    handleContentPaste,
    isEditing,
  } = useCitationCardForm(props);

  const boxConfig = selectedBoxObj
    ? getBoxTypeBadgeConfig(selectedBoxObj.boxType)
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      {/* 1. Kaynak Seçimi & Hedef Tez Bölümü */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Akademik Kaynak (Otomatik Konu Kutusu Rozetiyle) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="source-select"
              className="text-xs font-semibold text-foreground flex items-center gap-1.5"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              Akademik Kaynak
            </Label>
            {selectedBoxObj && boxConfig && (
              <Badge
                variant="outline"
                className="text-[10px] h-4.5 px-1.5 gap-1 font-medium bg-muted/50 border-border text-muted-foreground"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    boxConfig.dotClassName,
                  )}
                />
                <span className="truncate max-w-[120px]">
                  {selectedBoxObj.title}
                </span>
              </Badge>
            )}
          </div>

          <Select
            value={formFields.selectedSourceId}
            onValueChange={(v) => setField("selectedSourceId", v)}
          >
            <SelectTrigger
              id="source-select"
              className="h-9 text-xs bg-background border-border"
            >
              <SelectValue placeholder="Kaynak Seçin">
                {selectedSourceObj
                  ? `${selectedSourceObj.title} (${selectedSourceObj.authors[0] ?? "Yazar"}, ${selectedSourceObj.publicationYear})`
                  : "Kaynak Seçin"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {sources.map((src) => (
                <SelectItem
                  key={src.id}
                  value={String(src.id)}
                  className="text-xs py-2"
                >
                  <span className="font-medium">{src.title}</span> (
                  {src.authors[0] ?? "Yazar"}, {src.publicationYear})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tez İskeleti / Hedef Bölüm */}
        <div className="space-y-1.5">
          <Label
            htmlFor="outline-select"
            className="text-xs font-semibold text-foreground flex items-center gap-1.5"
          >
            <FolderTree className="h-3.5 w-3.5 text-primary" />
            Tez Bölümü (Hedef İskelet)
          </Label>
          <Select
            value={formFields.selectedOutlineId}
            onValueChange={(v) => setField("selectedOutlineId", v)}
          >
            <SelectTrigger
              id="outline-select"
              className="h-9 text-xs bg-background border-border"
            >
              <SelectValue placeholder="Bölüm Seçin">
                {formFields.selectedOutlineId === "NONE" ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Ban className="h-3.5 w-3.5 shrink-0" />
                    <span>Bölüme Bağlanmadı (Boşta)</span>
                  </span>
                ) : selectedOutlineObj ? (
                  <span className="flex items-center gap-1.5 text-foreground font-medium truncate">
                    {selectedOutlineObj.parentId ? (
                      <CornerDownRight className="h-3 w-3 text-primary shrink-0" />
                    ) : (
                      <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    <span className="truncate">{selectedOutlineObj.title}</span>
                  </span>
                ) : (
                  "Bölüm Seçin"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <OutlineSelectItems
                outlines={outlines}
                includeNoneOption={true}
                noneLabel="Bölüme Bağlanmadı (Boşta Kalsın)"
              />
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 2. Not Türü + Sayfa Numarası */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Not Türü */}
        <div className="space-y-1.5">
          <Label
            htmlFor="note-type-select"
            className="text-xs font-semibold text-foreground"
          >
            Not Türü
          </Label>
          <Select
            value={formFields.noteType}
            onValueChange={(val: string) =>
              setField("noteType", val as CitationNoteType)
            }
          >
            <SelectTrigger
              id="note-type-select"
              className="h-9 text-xs bg-background border-border"
            >
              <SelectValue>
                {NOTE_TYPE_DISPLAY_LABELS[formFields.noteType]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DIRECT_QUOTE" className="text-xs">
                Doğrudan Alıntı
              </SelectItem>
              <SelectItem value="PARAPHRASE" className="text-xs">
                Dolaylı Alıntı
              </SelectItem>
              <SelectItem value="PERSONAL_NOTE" className="text-xs">
                Kişisel Not
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sayfa Numarası */}
        <div className="space-y-1.5">
          <Label
            htmlFor="page-number-input"
            className="text-xs font-semibold text-foreground"
          >
            Sayfa Numarası
          </Label>
          <Input
            id="page-number-input"
            placeholder="Örn: 15 veya 15-17"
            value={formFields.pageNumber}
            onChange={(e) => setField("pageNumber", e.target.value)}
            className="h-9 text-xs font-mono bg-background border-border"
          />
        </div>
      </div>

      {/* 3. Fiş İçeriği (Metin) */}
      <div className="space-y-1.5">
        <Label
          htmlFor="content-textarea"
          className="text-xs font-semibold text-foreground"
        >
          Fiş İçeriği (Metin)
        </Label>
        <Textarea
          id="content-textarea"
          rows={4}
          placeholder="Alıntılanan metni, kendi cümlenizle açımlamayı veya tez notunuzu buraya yazın..."
          value={formFields.content}
          onChange={(e) => setField("content", e.target.value)}
          onPaste={handleContentPaste}
          className="font-sans leading-relaxed resize-none overflow-y-auto text-xs bg-background border-border"
        />
      </div>

      {/* 4. Kişisel Yorum / Şerh (Opsiyonel) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <MessageSquareQuote className="h-3.5 w-3.5 text-primary" />
          <Label
            htmlFor="comment-textarea"
            className="text-xs font-semibold text-foreground"
          >
            Düşünce / Şerh
          </Label>
          <span className="text-[10px] text-muted-foreground font-normal">
            (Opsiyonel)
          </span>
        </div>
        <Textarea
          id="comment-textarea"
          rows={2}
          placeholder="Bu fişi tez çalışmanızda nasıl değerlendireceğinize dair kendi şerh veya yorumunuzu ekleyin..."
          value={formFields.comment}
          onChange={(e) => setField("comment", e.target.value)}
          className="text-xs leading-relaxed resize-none overflow-y-auto bg-background border-border"
        />
      </div>

      {/* 5. Footer Buttons */}
      <DialogFooter className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-8 px-4 text-xs"
        >
          İptal
        </Button>
        <Button type="submit" size="sm" className="h-8 px-4 text-xs">
          {isEditing ? "Değişiklikleri Kaydet" : "Fiş Oluştur"}
        </Button>
      </DialogFooter>
    </form>
  );
}
