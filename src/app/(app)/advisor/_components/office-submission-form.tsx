"use client";

import { useState } from "react";
import {
  Send,
  Sparkles,
  HelpCircle,
  Loader2,
  BookOpen,
  ShieldCheck,
  FileEdit,
  Swords,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutlineId || !draftText.trim()) return;

    await onSubmit({
      outlineId: Number(selectedOutlineId),
      draftText: draftText.trim(),
      studentNote: studentNote.trim() || undefined,
    });
  };

  const trimmedDraft = draftText.trim();
  const wordCount = trimmedDraft ? trimmedDraft.split(/\s+/).length : 0;
  const paragraphCount = trimmedDraft
    ? trimmedDraft.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length
    : 0;
  const estimatedPages = wordCount > 0 ? (wordCount / 250).toFixed(1) : "0";

  // Dynamic context and length assessment
  const isOptimalLength = wordCount >= 60 && wordCount <= 650;
  const isLongLength = wordCount > 650;
  const isVeryShort = wordCount > 0 && wordCount < 60;

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
                  İlgili tez bölümünü seçin ve Word&apos;de yazdığınız 1–3
                  paragraflık pasajınızı yapıştırın.
                </CardDescription>
              </div>
            </div>

            {/* Dynamic Status Counter Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <span
                className={`text-xs font-mono px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                  isOptimalLength
                    ? "bg-primary/10 text-primary border-primary/20"
                    : isLongLength
                      ? "bg-warning/10 text-warning border-warning/20"
                      : "bg-muted text-muted-foreground border-border"
                }`}
              >
                <span>{wordCount} / 650 kelime</span>
                <span className="opacity-60 text-[10px]">
                  (~{estimatedPages} sayfa
                  {paragraphCount > 0 ? `, ${paragraphCount} paragraf` : ""})
                </span>
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Outline Chapter Selector */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="outline-selector"
                className="text-xs font-medium text-foreground flex items-center justify-between"
              >
                <span>İnceleme Yapılacak Tez Bölümü</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Zorunlu
                </span>
              </Label>
              <Select
                value={selectedOutlineId}
                onValueChange={setSelectedOutlineId}
              >
                <SelectTrigger
                  id="outline-selector"
                  disabled={isSubmitting}
                  className="w-full text-xs h-9 bg-background border-border"
                >
                  <SelectValue placeholder="Bir tez bölümü seçin..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {outlines.length === 0 ? (
                    <SelectItem value="empty" disabled className="text-xs">
                      Tanımlı tez bölümü bulunamadı
                    </SelectItem>
                  ) : (
                    outlines.map((outline) => (
                      <SelectItem
                        key={outline.id}
                        value={String(outline.id)}
                        className="text-xs py-2"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">{outline.title}</span>
                          {outline.parentId && (
                            <span className="text-[10px] text-muted-foreground">
                              (Alt Bölüm)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Draft Passage Input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="draft-text"
                  className="text-xs font-medium text-foreground"
                >
                  Taslak Pasaj Metni (Word&apos;den Yapıştırın)
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {isOptimalLength ? (
                    <span className="text-primary font-medium">
                      ✓ İdeal Analiz Boyutu
                    </span>
                  ) : isLongLength ? (
                    <span className="text-warning font-medium">
                      ⚠ Geniş Pasaj (Bölümlere ayırmanız önerilir)
                    </span>
                  ) : isVeryShort ? (
                    <span className="text-muted-foreground">Kısa Pasaj</span>
                  ) : (
                    <span>Önerilen: 1–3 Paragraf (~1–2 Sayfa)</span>
                  )}
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
                <Label
                  htmlFor="student-note"
                  className="text-xs font-medium text-foreground flex items-center gap-1.5"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  Danışmana İsteğe Bağlı Not / Özel Soru
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Opsiyonel
                </span>
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
                <span>
                  RAG Kaynakları, Alıntı Fişleri ve Jüri Perspektifi ile
                  doğrulanır.
                </span>
              </div>

              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !selectedOutlineId ||
                  draftText.trim().length < 10
                }
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
          <div className="flex items-center gap-2 text-warning">
            <ShieldCheck className="h-4 w-4" />
            <h4 className="font-serif text-xs font-semibold text-foreground">
              Katı Kaynak & Sayfa Denetimi
            </h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Metninizdeki yazar, yıl ve sayfa numaraları PDF parçaları ve
            fişlerle satır satır çapraz kontrol edilir.
          </p>
        </Card>

        <Card className="border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <FileEdit className="h-4 w-4" />
            <h4 className="font-serif text-xs font-semibold text-foreground">
              Zararsız Editoryal Rötuş
            </h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Özgün üslubunuz ve argümanınız asla bozulmaz; yalnızca akademik
            akış, APA formatı ve anlatım pürüzleri giderilir.
          </p>
        </Card>

        <Card className="border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-warning">
            <Swords className="h-4 w-4" />
            <h4 className="font-serif text-xs font-semibold text-foreground">
              Jüri Şerhleri & Savunma
            </h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tez savunmasında jürinin sorabileceği mantık sıçramaları ve
            temellendirilmemiş iddialar canlı müzakereye açılır.
          </p>
        </Card>
      </div>
    </div>
  );
}
