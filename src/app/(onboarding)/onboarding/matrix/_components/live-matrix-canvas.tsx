"use client";

import { useState, memo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Target,
  Compass,
  Database,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  Edit3,
  Check,
  X,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MatrixValueMarkdown } from "@/components/shared/matrix-value-markdown";
import type { ThesisMatrix } from "@/lib/types";
import {
  evaluateMatrixReadiness,
  type MatrixFieldKey,
} from "../_services/rubrics";

interface CanvasQuadrantConfig {
  key: MatrixFieldKey;
  number: string;
  Icon: LucideIcon;
  label: string;
  shortHint: string;
}

const QUADRANTS: CanvasQuadrantConfig[] = [
  {
    key: "subjectProblem",
    number: "01",
    Icon: Target,
    label: "Araştırma Problemi, Aktörler ve Odak",
    shortHint:
      "Çözülmek istenen problem gerilimi, aktörler ve araştırma sorusu.",
  },
  {
    key: "theoreticalFramework",
    number: "02",
    Icon: Compass,
    label: "Teorik ve Kavramsal Çerçeve",
    shortHint: "Temel alınan kuram, kavramsal model veya analitik paradigma.",
  },
  {
    key: "primaryMaterial",
    number: "03",
    Icon: Database,
    label: "Veri Kaynağı / Birincil Malzeme",
    shortHint: "İncelenecek arşiv, saha verisi, belgeler veya hedef kitle.",
  },
  {
    key: "methodology",
    number: "04",
    Icon: BookOpen,
    label: "Metodoloji",
    shortHint: "Araştırma deseni, veri toplama ve analiz tekniği.",
  },
];

interface LiveMatrixCanvasProps {
  matrix: Partial<ThesisMatrix>;
  onFieldChange: (field: MatrixFieldKey, value: string) => void;
  onSubmitMatrix: () => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Interactive Live Matrix Canvas adhering strictly to UI_RULES.md.
 * Features internal scrollable quadrants, fixed studio header and sticky submission footer.
 */
export const LiveMatrixCanvas = memo(function LiveMatrixCanvas({
  matrix,
  onFieldChange,
  onSubmitMatrix,
  isSubmitting,
}: LiveMatrixCanvasProps) {
  const readiness = evaluateMatrixReadiness(matrix);
  const [editingField, setEditingField] = useState<MatrixFieldKey | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (field: MatrixFieldKey, currentVal: string) => {
    setEditingField(field);
    setEditValue(currentVal);
  };

  const handleSaveEdit = (field: MatrixFieldKey) => {
    onFieldChange(field, editValue);
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
  };

  return (
    <div className="flex flex-col h-full rounded-lg bg-card border border-border overflow-hidden">
      {/* Studio Matrix Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="size-7 rounded-md border border-primary/20 bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
              Yaşayan Tez Matrisi
            </h2>
            <p className="text-xs font-medium text-muted-foreground">
              Müzakere edildikçe kadranlar otomatik kristalize olur
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className={`px-2 py-0.5 text-xs font-medium rounded-md font-mono ${
            readiness.isFullyReady
              ? "bg-success/10 border-success/20 text-success"
              : "bg-secondary text-secondary-foreground border-border"
          }`}
        >
          {readiness.completedCount} / {readiness.totalCount} Kadran
        </Badge>
      </div>

      {/* Internal Scrollable Quadrants */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0">
        {QUADRANTS.map(({ key, number, Icon, label, shortHint }) => {
          const value = matrix[key]?.trim() ?? "";
          const isCompleted = value.length >= 20;
          const isDiscussing = value.length > 0 && !isCompleted;
          const isCurrentlyEditing = editingField === key;

          return (
            <Card
              key={key}
              className={`p-3.5 rounded-lg transition-all border ${
                isCompleted
                  ? "border-primary/20 bg-background/60"
                  : isDiscussing
                    ? "border-warning/20 bg-background/60"
                    : "border-border/60 bg-background/30"
              }`}
            >
              {/* Quadrant Header */}
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/40">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {number}
                  </span>
                  <div className="size-6 rounded-md bg-secondary text-secondary-foreground border border-border flex items-center justify-center shrink-0">
                    <Icon className="size-3" />
                  </div>
                  <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
                    {label}
                  </h3>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-success/10 border border-success/20 text-success">
                      <CheckCircle2 className="size-3" />
                      Tamamlandı
                    </span>
                  ) : isDiscussing ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-warning/10 border border-warning/20 text-warning">
                      <Clock className="size-3" />
                      Tartışılıyor
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                      Beklemede
                    </span>
                  )}

                  {!isCurrentlyEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground [&_svg]:size-3"
                      onClick={() => handleStartEdit(key, value)}
                      title="Manuel Düzenle"
                    >
                      <Edit3 className="size-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Quadrant Content */}
              <div className="pt-2">
                {isCurrentlyEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={3}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={shortHint}
                      className="textarea-academic text-xs leading-relaxed resize-none"
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2.5 rounded-md [&_svg]:size-3"
                        onClick={handleCancelEdit}
                      >
                        <X className="mr-1" />
                        İptal
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs px-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 [&_svg]:size-3"
                        onClick={() => handleSaveEdit(key)}
                      >
                        <Check className="mr-1" />
                        Kaydet
                      </Button>
                    </div>
                  </div>
                ) : value ? (
                  <MatrixValueMarkdown content={value} />
                ) : (
                  <p className="text-xs font-normal italic text-muted-foreground">
                    {shortHint} Danışmanla konuştukça bu alan otomatik
                    kristalize olacaktır.
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Sticky Bottom Submission CTA */}
      <div className="p-3 border-t border-border bg-card shrink-0">
        <Button
          type="button"
          onClick={onSubmitMatrix}
          disabled={!readiness.isFullyReady || isSubmitting}
          className="w-full h-8 text-xs px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all font-medium [&_svg]:size-3.5"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 animate-spin" />
              Matris Mühürleniyor ve Taranıyor...
            </>
          ) : (
            <>
              Matrisi Mühürle ve Konumlandırmaya Geç
              <ArrowRight className="ml-1.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
});
