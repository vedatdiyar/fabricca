"use client";

import React from "react";
import {
  Sparkles,
  FileText,
  Quote,
  Tags,
  AlertCircle,
  Link2,
  Compass,
  Brain,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export interface Box {
  id: number;
  name: string;
  description: string | null;
}

export interface NoteFormData {
  mainArgument: string;
  quotes: string;
  concepts: string;
  criticalNotes: string;
  connections: string;
  researchNotes: string;
  memoryAnchors: string;
  selectedBoxId: number | null;
  isSavingNote: boolean;
  prevEditingNoteId: number | null;
  prevIsOpen: boolean;
}

interface NoteFormFieldsProps {
  formData: NoteFormData;
  boxes: Box[];
  handleFieldChange: <K extends keyof NoteFormData>(
    field: K,
    value: NoteFormData[K],
  ) => void;
}

export function NoteFormFields({
  formData,
  boxes,
  handleFieldChange,
}: NoteFormFieldsProps) {
  return (
    <>
      {/* Tasnif Seçici */}
      {boxes.length > 0 && (
        <div className="flex flex-col space-y-2 bg-muted/40 border border-border rounded-lg p-4 transition duration-150">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary shrink-0" />
            <span>Entelektüel Kumbara (Tasnif)</span>
          </label>
          <p className="text-[10px] text-muted-foreground leading-normal mb-1">
            Notunuzu doğrudan tezinizin ilgili bölümüne fırlatarak arşivleyin.
          </p>
          <select
            value={formData.selectedBoxId || ""}
            onChange={(e) => {
              const val = e.target.value;
              handleFieldChange(
                "selectedBoxId",
                val ? parseInt(val, 10) : null,
              );
            }}
            aria-label="Notun ilişkilendirileceği tematik tez çalışma kutusu"
            className="bg-card border border-border text-xs rounded-md p-2.5 text-foreground font-sans outline-none focus:border-primary/50 transition cursor-pointer"
          >
            <option value="">-- Tasnif Dışı (Kumbara Seçilmedi) --</option>
            {boxes.map((box, idx) => (
              <option key={box.id} value={box.id}>
                Bölüm {idx + 1}: {box.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 1. Ana Argüman */}
      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileText className="size-3.5 text-primary shrink-0" />
          <span>Ana Argüman (Tez)</span>
        </label>
        <Textarea
          value={formData.mainArgument}
          onChange={(e) => handleFieldChange("mainArgument", e.target.value)}
          placeholder="Metnin temel tezini ve ana savunu buraya yazın..."
          className="min-h-[90px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
        />
      </div>

      {/* 2. Önemli Alıntılar */}
      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Quote className="size-3.5 text-primary shrink-0" />
          <span>Önemli Alıntılar (Sayfa No ile)</span>
        </label>
        <Textarea
          value={formData.quotes}
          onChange={(e) => handleFieldChange("quotes", e.target.value)}
          placeholder="Sayfa numaralarıyla birlikte birebir atıf alıntılarını ekleyin (Örn: Sayfa 24: '...')"
          className="min-h-[90px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
        />
      </div>

      {/* 3. Kavramlar ve Temalar */}
      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Tags className="size-3.5 text-primary shrink-0" />
          <span>Kavramlar ve Temalar</span>
        </label>
        <Input
          value={formData.concepts}
          onChange={(e) => handleFieldChange("concepts", e.target.value)}
          placeholder="Virgülle ayırarak anahtar kavramları girin (Örn: Disiplin, VYŞ, İktidar)"
          className="p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 font-sans h-9"
        />
      </div>

      {/* 4. Eleştirel Not */}
      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="size-3.5 text-primary shrink-0" />
          <span>Eleştirel Not</span>
        </label>
        <Textarea
          value={formData.criticalNotes}
          onChange={(e) => handleFieldChange("criticalNotes", e.target.value)}
          placeholder="Yazarın argümanına veya teorik çerçevesine dair kendi eleştirileriniz..."
          className="min-h-[90px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
        />
      </div>

      {/* 5. Diğer Metinlerle Bağlantı */}
      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Link2 className="size-3.5 text-primary shrink-0" />
          <span>Diğer Metinlerle Bağlantı</span>
        </label>
        <Textarea
          value={formData.connections}
          onChange={(e) => handleFieldChange("connections", e.target.value)}
          placeholder="Literatürdeki diğer makalelerle veya teorilerle kurduğu organik bağlar..."
          className="min-h-[90px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
        />
      </div>

      {/* 6. Araştırmam İçin Not */}
      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Compass className="size-3.5 text-primary shrink-0" />
          <span>Araştırmam İçin Not</span>
        </label>
        <Textarea
          value={formData.researchNotes}
          onChange={(e) => handleFieldChange("researchNotes", e.target.value)}
          placeholder="Bu notun doğrudan sizin tezinize/araştırmanıza nasıl katkı sunacağı..."
          className="min-h-[90px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
        />
      </div>

      {/* 7. Hafıza Notu */}
      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Brain className="size-3.5 text-primary shrink-0" />
          <span>Hafıza Notu</span>
        </label>
        <Textarea
          value={formData.memoryAnchors}
          onChange={(e) => handleFieldChange("memoryAnchors", e.target.value)}
          placeholder="Metni zihinde tutmayı kolaylaştıracak kişisel ipuçları veya somutlama cümleleri..."
          className="min-h-[60px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
        />
      </div>
    </>
  );
}
