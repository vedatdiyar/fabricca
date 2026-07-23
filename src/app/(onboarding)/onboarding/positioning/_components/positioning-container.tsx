"use client";

import { useState, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  Target,
  Boxes,
  Compass,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  BookOpen,
  ExternalLink,
  Search,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ThesisPositioning } from "@/db/schema";
import { runPositioningPipelineAction } from "../actions";
import { positioningMatrixSchema } from "../_lib/validation";
import type {
  PositioningMatrixInput,
  PositioningGlobalStatus,
} from "../_lib/validation";
import type { JuryAnalysisResult } from "../_services/analysis";
import { PositioningMarkdownRenderer } from "./positioning-markdown-renderer";

type FieldKey = keyof PositioningMatrixInput;

interface FieldConfig {
  key: FieldKey;
  id: string;
  number: string;
  Icon: LucideIcon;
  label: string;
  description: string;
  placeholder: string;
  rows: number;
  minLength: number;
}

interface SectionConfig {
  id: string;
  title: string;
  fields: FieldConfig[];
}

const POSITIONING_SECTIONS: SectionConfig[] = [
  {
    id: "odakVeTeori",
    title: "Çalışma Odağı ve Teorik Altyapı",
    fields: [
      {
        key: "subjectAndProblem",
        id: "subjectAndProblem",
        number: "01",
        Icon: Target,
        label: "Çalışmanın Odağı & Problemi",
        description:
          "Neyi, hangi temel problemi çözmek veya hangi hipotezi test etmek için inceliyorsun?",
        placeholder:
          "Çalışmanızın odağını, çözmeyi hedeflediğiniz temel problemi ve araştırma hipotezlerinizi en az 200 karakterle detaylandırın...",
        rows: 4,
        minLength: 200,
      },
      {
        key: "theoreticalFramework",
        id: "theoreticalFramework",
        number: "02",
        Icon: Compass,
        label: "Teorik / Kavramsal Çerçeve",
        description:
          "Çalışmanı hangi teorik mercekle, modelle veya kavramsal yaklaşımla ele alıyorsun?",
        placeholder:
          "Temel aldığınız teorik merceği, kavramsal modelleri ve analitik yaklaşımınızı en az 200 karakterle açıklayın...",
        rows: 4,
        minLength: 200,
      },
    ],
  },
  {
    id: "analizYontemKapsam",
    title: "Analiz Birimi, Metodoloji ve Kapsam Sınırları",
    fields: [
      {
        key: "unitOfAnalysis",
        id: "unitOfAnalysis",
        number: "03",
        Icon: Boxes,
        label: "Analiz Birimi / Aktörler / Odak Nesne",
        description:
          "Veriyi nereden topluyorsun? Kimi, hangi veri kümesini, materyali veya aktörleri inceliyorsun?",
        placeholder:
          "İncelediğiniz aktörleri, veri setlerini, materyalleri veya odak nesnelerinizi en az 150 karakterle tanımlayın...",
        rows: 3,
        minLength: 150,
      },
      {
        key: "methodology",
        id: "methodology",
        number: "04",
        Icon: BookOpen,
        label: "Metodoloji & Yöntem",
        description:
          "Veriyi nasıl topluyor, işliyor veya ölçüyorsun? (Nitel, nicel, deneysel, simülasyon vb.)",
        placeholder:
          "Veri toplama, veri işleme ve analiz yöntemlerinizi (nitel/nicel/deneysel/simülasyon) en az 150 karakterle detaylandırın...",
        rows: 3,
        minLength: 150,
      },
      {
        key: "scopeAndContext",
        id: "scopeAndContext",
        number: "05",
        Icon: MapPin,
        label: "Kapsam & Sınırlar",
        description:
          "Çalışmanın zaman, mekan, sektör, örneklem veya coğrafi sınırları nedir?",
        placeholder:
          "Çalışmanızın dönemsel, coğrafi, sektörel veya örneklem sınırlarını en az 150 karakterle belirteyin...",
        rows: 3,
        minLength: 150,
      },
    ],
  },
];

const INITIAL_STATE: PositioningMatrixInput = {
  subjectAndProblem: "",
  theoreticalFramework: "",
  unitOfAnalysis: "",
  methodology: "",
  scopeAndContext: "",
};

interface PositioningCardProps {
  fieldKey: FieldKey;
  id: string;
  number: string;
  Icon: LucideIcon;
  label: string;
  description: string;
  placeholder: string;
  value: string;
  rows: number;
  minLength: number;
  error?: string;
  onChange: (key: FieldKey, value: string) => void;
}

/**
 * Academic form field card for the positioning matrix with real-time character limit count.
 */
const PositioningCard = memo(function PositioningCard({
  fieldKey,
  id,
  number,
  Icon,
  label,
  description,
  placeholder,
  value,
  rows,
  minLength,
  error,
  onChange,
}: PositioningCardProps) {
  const charCount = (value || "").trim().length;
  const isSatisfied = charCount >= minLength;

  return (
    <Card className="space-y-3 p-4 hover:border-primary/30 rounded-md transition-all shadow-xs">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-primary/10 text-[10px] font-bold tracking-wider text-primary">
              {number}
            </span>
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <Label
              htmlFor={id}
              className="cursor-pointer text-sm font-semibold text-foreground"
            >
              {label}
            </Label>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`font-mono text-[11px] ${
                isSatisfied
                  ? "text-emerald-600 dark:text-emerald-400 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {charCount} / {minLength} min
            </span>
            {isSatisfied && (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
          </div>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground pl-9 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Textarea
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        rows={rows}
        className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
      />
      {error && (
        <p className="text-xs text-destructive mt-1 font-medium">{error}</p>
      )}
    </Card>
  );
});

interface PositioningContainerProps {
  initialRecord?: ThesisPositioning | null;
}

type ViewMode = "form" | "loading" | "report";

/**
 * PositioningContainer Component (FAZ 5 UI/UX).
 * Controls the 3 primary UI states: form -> loading -> report.
 */
export function PositioningContainer({
  initialRecord,
}: PositioningContainerProps) {
  const router = useRouter();

  // Determine initial state from pre-existing DB record
  const hasExistingReport = !!(
    initialRecord &&
    initialRecord.globalStatus &&
    initialRecord.gapAnalysisSummary
  );

  const [viewMode, setViewMode] = useState<ViewMode>(
    hasExistingReport ? "report" : "form",
  );

  const [formState, setFormState] = useState<PositioningMatrixInput>(
    initialRecord?.matrixInput ?? INITIAL_STATE,
  );

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [reportData, setReportData] = useState<JuryAnalysisResult | null>(
    hasExistingReport
      ? {
          globalStatus: initialRecord.globalStatus as PositioningGlobalStatus,
          gapAnalysisSummary: initialRecord.gapAnalysisSummary ?? "",
          recommendedTheses:
            (initialRecord.recommendedTheses as JuryAnalysisResult["recommendedTheses"]) ??
            [],
        }
      : null,
  );

  const handleFieldChange = useCallback((key: FieldKey, value: string) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const parsed = positioningMatrixSchema.safeParse(formState);
    if (!parsed.success) {
      const formattedErrors: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldKey;
        if (field && !formattedErrors[field]) {
          formattedErrors[field] = issue.message;
        }
      }
      setErrors(formattedErrors);
      toast.error(
        "Lütfen formdaki tüm alanları eksiksiz ve geçerli şekilde doldurun.",
      );
      return;
    }

    const validatedData = parsed.data;
    setViewMode("loading");

    try {
      const res = await runPositioningPipelineAction(validatedData);
      if ("error" in res && res.error) {
        toast.error(res.error);
        setViewMode("form");
      } else if ("success" in res && res.success) {
        toast.success(
          "Konumlandırma analizi ve jüri değerlendirmesi tamamlandı!",
        );
        setReportData(res.report);
        setViewMode("report");
      }
    } catch {
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.");
      setViewMode("form");
    }
  };

  const handleConfirmAndProceed = useCallback(() => {
    toast.success("Konumlandırma onaylandı. Konu kutuları oluşturuluyor...");
    router.push("/onboarding/boxes");
  }, [router]);

  // Render Loading Overlay View
  if (viewMode === "loading") {
    return (
      <Card className="w-full p-8 my-6 flex flex-col items-center justify-center space-y-6 text-center border-primary/20 bg-card/50 backdrop-blur-sm shadow-md">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-20 w-20 rounded-full border-4 border-primary/20 animate-ping" />
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>

        <div className="space-y-2 max-w-lg">
          <h3 className="font-serif text-lg font-bold text-foreground">
            Akademik Konumlandırma & Jüri Analizi Çalıştırılıyor
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Literatür taranıyor, Cohere ile anlamsal süzme yapılıyor ve özgünlük
            boşluğu analiz ediliyor...
          </p>
        </div>

        <div className="w-full max-w-md space-y-3 pt-4 border-t border-border/60 text-left">
          <div className="flex items-center gap-3 text-xs text-foreground/80">
            <Search className="h-4 w-4 text-primary animate-pulse shrink-0" />
            <span>
              1. 3 katmanlı akademik arama sorguları üretiliyor (Gemini
              Flash-Lite)
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-foreground/80">
            <BookOpen className="h-4 w-4 text-primary animate-pulse shrink-0" />
            <span>
              2. Tezara veritabanı taranıyor & Cohere Rerank ile süzülüyor
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-foreground/80">
            <Sparkles className="h-4 w-4 text-primary animate-pulse shrink-0" />
            <span>
              3. Yapay zeka akademisyen jürisi özgünlük boşluğunu raporluyor
            </span>
          </div>
        </div>
      </Card>
    );
  }

  // Render Report View
  if (viewMode === "report" && reportData) {
    const isNovelGap = reportData.globalStatus === "NOVEL_GAP_IDENTIFIED";
    const isDirectOverlap = reportData.globalStatus === "DIRECT_OVERLAP";

    return (
      <div className="w-full space-y-8 pb-12">
        {/* Top Section: Global Status Badge & Summary Header */}
        <Card className="p-6 space-y-4 border-border shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Jüri Değerlendirme Sonucu
              </span>
              <h2 className="font-serif text-xl font-bold text-foreground">
                Akademik Konumlandırma & Özgün Katkı Raporu
              </h2>
            </div>

            <div>
              {isNovelGap && (
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Özgün Katkı / Akademik Boşluk Bulundu
                </Badge>
              )}
              {isDirectOverlap && (
                <Badge
                  variant="destructive"
                  className="bg-destructive/10 text-destructive border-destructive/30 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                >
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  Doğrudan Çakışma Riski
                </Badge>
              )}
              {!isNovelGap && !isDirectOverlap && (
                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  Sınırlı Literatür / Bağlam Genişletilmeli
                </Badge>
              )}
            </div>
          </div>

          {/* Subtitle Message based on status */}
          <p className="text-xs leading-relaxed text-muted-foreground bg-muted/40 p-3 rounded-md">
            {isNovelGap &&
              "Çalışmanızın odağı, yöntemi ve kapsamı literatürdeki mevcut tezlerden belirgin biçimde ayrışmakta ve özgün bir akademik boşluk doldurmaktadır."}
            {isDirectOverlap &&
              "Çalışmanızın odağı literatürdeki mevcut tezlerle yüksek oranda çakışmaktadır. Jüri önerileri doğrultusunda teorik çerçeve veya yönteminizi güncellemeniz tavsiye edilir."}
            {!isNovelGap &&
              !isDirectOverlap &&
              "Doğrudan eşleşen tez sayısı sınırlıdır. Kavramsal çerçevenizi veya arama sınırlarınızı genişleterek tekrar değerlendirebilirsiniz."}
          </p>
        </Card>

        {/* Markdown Gap Analysis Summary Card */}
        <Card className="p-6 space-y-4 border-border shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-serif text-base font-bold text-foreground">
              Yapay Zeka Akademisyen Jüri Sentezi
            </h3>
          </div>

          <PositioningMarkdownRenderer
            content={reportData.gapAnalysisSummary}
            className="pt-2"
          />
        </Card>

        {/* Guiding Thesis Cards Section */}
        {reportData.recommendedTheses &&
          reportData.recommendedTheses.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Stratejik Rehber Tez Kartları (
                  {reportData.recommendedTheses.length})
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-1 gap-4">
                {reportData.recommendedTheses.map((thesis, idx) => {
                  const thesisId = thesis.externalThesisId || `thesis-${idx}`;
                  return (
                    <Card
                      key={thesisId}
                      className="p-5 space-y-3 hover:border-primary/30 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h4 className="font-serif text-sm font-bold text-foreground leading-snug">
                            {thesis.title}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {[thesis.author, thesis.year, thesis.university]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                        </div>
                        {thesis.doi && (
                          <a
                            href={
                              thesis.doi.startsWith("http")
                                ? thesis.doi
                                : `https://doi.org/${thesis.doi}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0 self-start"
                          >
                            DOI <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {(thesis.contributionArea || thesis.relevanceReason) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border/60 text-xs">
                          {thesis.contributionArea && (
                            <div className="p-2.5 rounded bg-primary/5 border border-primary/10 space-y-1">
                              <span className="font-semibold text-primary block">
                                📌 Katkı / Odak Alanı:
                              </span>
                              <span className="text-foreground/90 leading-relaxed block">
                                {thesis.contributionArea}
                              </span>
                            </div>
                          )}

                          {thesis.relevanceReason && (
                            <div className="p-2.5 rounded bg-muted/60 border border-border/80 space-y-1">
                              <span className="font-semibold text-foreground/80 block">
                                💡 İlişki ve Ayrışma Sebebi:
                              </span>
                              <span className="text-muted-foreground leading-relaxed block">
                                {thesis.relevanceReason}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

        {/* Bottom Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => setViewMode("form")}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Matrisi Düzenle & Yeniden Analiz Et
          </Button>

          <Button
            type="button"
            size="lg"
            onClick={handleConfirmAndProceed}
            className="w-full sm:w-auto font-semibold"
          >
            Konumlandırmayı Onayla ve İlerle
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Render Form View (Default)
  return (
    <form onSubmit={handleSubmit} className="w-full space-y-8 pb-8">
      {POSITIONING_SECTIONS.map((section) => (
        <div key={section.id} className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.title}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {section.fields.map(
              ({
                key,
                id,
                number,
                Icon,
                label,
                description,
                placeholder,
                rows,
                minLength,
              }) => (
                <PositioningCard
                  key={id}
                  fieldKey={key}
                  id={id}
                  number={number}
                  Icon={Icon}
                  label={label}
                  description={description}
                  placeholder={placeholder}
                  value={formState[key] || ""}
                  rows={rows}
                  minLength={minLength}
                  error={errors[key]}
                  onChange={handleFieldChange}
                />
              ),
            )}
          </div>
        </div>
      ))}

      <div className="flex justify-end mt-8 pb-8">
        <Button type="submit" size="lg" className="font-semibold">
          <Sparkles className="w-4 h-4 mr-2" />
          Konumlandırmayı Analiz Et ve Jüri Değerlendirmesine Gönder
        </Button>
      </div>
    </form>
  );
}
