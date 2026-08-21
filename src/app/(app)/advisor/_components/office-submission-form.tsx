"use client";

import { useState } from "react";
import {
  Send,
  Sparkles,
  HelpCircle,
  Loader2,
  Layers,
  ShieldCheck,
  FileEdit,
  Swords,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OutlineOption } from "../office-actions";

interface OfficeSubmissionFormProps {
  outlines: OutlineOption[];
  isSubmitting: boolean;
  onSubmit: (data: {
    outlineId: number;
    draftText: string;
    studentNote?: string;
  }) => Promise<void>;
}

/**
 * Phase 1: Submission Form (Taslak Teslim Masası).
 * Clean, spacious, and responsive draft submission workspace.
 */
export function OfficeSubmissionForm({
  outlines,
  isSubmitting,
  onSubmit,
}: OfficeSubmissionFormProps) {
  const [selectedOutlineId, setSelectedOutlineId] = useState<string>(
    outlines[0]?.id ? String(outlines[0].id) : "",
  );
  const [draftText, setDraftText] = useState("");
  const [studentNote, setStudentNote] = useState("");

  const selectedOutline = outlines.find(
    (o) => String(o.id) === selectedOutlineId,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutlineId || !draftText.trim()) return;

    await onSubmit({
      outlineId: Number(selectedOutlineId),
      draftText: draftText.trim(),
      studentNote: studentNote.trim() || undefined,
    });
  };

  const wordCount = draftText.trim()
    ? draftText.trim().split(/\s+/).length
    : 0;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Main Submission Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
                <PenLine className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-serif text-lg font-semibold tracking-tight text-foreground">
                  Taslak Teslim Masası
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  İlgili tez bölümünü seçin ve Word&apos;de yazdığınız 1–3 paragraflık metni yapıştırın.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
                {wordCount} kelime
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 pt-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Outline Selection */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="outline-select" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Hedef Tez Bölümü (Outline)
                </Label>
                {selectedOutline?.description && (
                  <span className="text-[11px] text-muted-foreground max-w-sm truncate hidden sm:inline">
                    {selectedOutline.description}
                  </span>
                )}
              </div>

              {outlines.length > 0 ? (
                <Select
                  value={selectedOutlineId}
                  onValueChange={setSelectedOutlineId}
                >
                  <SelectTrigger
                    id="outline-select"
                    disabled={isSubmitting}
                    className="w-full text-xs h-10 bg-background border-border cursor-pointer"
                  >
                    <SelectValue placeholder="İlgili tez bölümünü seçin..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {outlines.map((outline) => (
                      <SelectItem
                        key={outline.id}
                        value={String(outline.id)}
                        className="text-xs cursor-pointer"
                      >
                        {outline.parentId !== null ? "└─ " : ""}
                        {outline.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 text-xs rounded-md bg-muted text-muted-foreground border border-border">
                  Henüz bir tez içindekiler (outline) planı bulunamadı. Lütfen önce İçindekiler modülünden bölüm oluşturun.
                </div>
              )}
            </div>

            {/* Draft Textarea */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="draft-text" className="text-xs font-medium text-foreground">
                  Taslak Pasaj Metni (Word&apos;den Yapıştırın)
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  1–3 paragraf (Önerilen: 80–350 kelime)
                </span>
              </div>

              <Textarea
                id="draft-text"
                placeholder="Örnek: Laclau ve Mouffe (1985, ss. 110-125), hegemonya kavramını Gramsci'nin sınıf indirgemeci sınırlarından kurtararak söylemsel bir eklemlenme pratiği olarak yeniden tanımlar..."
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                disabled={isSubmitting}
                className="min-h-[160px] text-sm p-3.5 bg-background border-border resize-y leading-relaxed focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                required
              />
            </div>

            {/* Student Note / Concern */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="student-note" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  Danışmana İsteğe Bağlı Not / Özel Soru
                </Label>
                <span className="text-[10px] text-muted-foreground">Opsiyonel</span>
              </div>

              <Textarea
                id="student-note"
                placeholder="Örnek: 'Hocam, Laclau'nun kavramsal tanımı ile seçtiğim ampirik vaka arasındaki metodolojik bağı kurarken tereddüt ettim, özellikle buraya odaklanabilir misiniz?'"
                value={studentNote}
                onChange={(e) => setStudentNote(e.target.value)}
                disabled={isSubmitting}
                className="min-h-[75px] text-xs p-3 bg-background border-border resize-y leading-relaxed"
              />
            </div>

            {/* Submit Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border mt-1">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>RAG Kaynakları, Alıntı Fişleri ve Jüri Perspektifi ile doğrulanır.</span>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !selectedOutlineId || draftText.trim().length < 10}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium px-5 h-10 gap-2 shrink-0 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Danışman İnceliyor...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>İncelemeye Gönder</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Guide Cards (3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldCheck className="h-4 w-4" />
            <h4 className="font-serif text-xs font-semibold text-foreground">
              Katı Kaynak & Sayfa Denetimi
            </h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Metninizdeki yazar, yıl ve sayfa numaraları PDF parçaları ve fişlerle satır satır çapraz kontrol edilir.
          </p>
        </Card>

        <Card className="border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-amber-500">
            <FileEdit className="h-4 w-4" />
            <h4 className="font-serif text-xs font-semibold text-foreground">
              Zararsız Editoryal Rötuş
            </h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Özgün üslubunuz ve argümanınız asla bozulmaz; yalnızca akademik akış, APA formatı ve anlatım pürüzleri giderilir.
          </p>
        </Card>

        <Card className="border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-blue-500">
            <Swords className="h-4 w-4" />
            <h4 className="font-serif text-xs font-semibold text-foreground">
              Jüri Şerhleri & Savunma
            </h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tez savunmasında jürinin sorabileceği mantık sıçramaları ve temellendirilmemiş iddialar canlı müzakereye açılır.
          </p>
        </Card>
      </div>
    </div>
  );
}
