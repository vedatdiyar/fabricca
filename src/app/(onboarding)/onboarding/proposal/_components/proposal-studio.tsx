"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Library,
  BookOpen,
  Globe,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AIBanner } from "@/components/shared/ai-banner";
import { useLoadingOverlay } from "@/core/providers/loading-overlay-provider";
import {
  PROPOSAL_AUDIT_STEPS,
  MATRIX_SYNTHESIS_STEPS,
  type LoadingStep,
} from "@/app/(onboarding)/onboarding/_services/loading-steps";
import {
  auditProposalAction,
  synthesizeAndSaveMatrixAction,
} from "@/app/(onboarding)/onboarding/matrix/actions";
import type { ProposalAuditResult } from "@/app/(onboarding)/onboarding/matrix/_services/proposal-audit-service";
import type { UserClarificationAnswer } from "@/app/(onboarding)/onboarding/matrix/_services/proposal-synthesis-service";

interface ProposalStudioProps {
  initialProposal?: string;
  initialAuditResult?: ProposalAuditResult;
}

/**
 * Onboarding Step 1: Proposal intake, multi-angle search, and diagnostic critique studio.
 *
 * @param props - Initial proposal and audit result.
 * @returns The rendered ProposalStudio.
 */
export function ProposalStudio({
  initialProposal = "",
  initialAuditResult,
}: ProposalStudioProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading, updateLoadingStep } = useLoadingOverlay();

  const [rawProposal, setRawProposal] = useState(initialProposal);
  const [stage, setStage] = useState<"input" | "questions">(
    initialAuditResult ? "questions" : "input",
  );
  const [auditResult, setAuditResult] = useState<ProposalAuditResult | null>(
    initialAuditResult ?? null,
  );
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>(() => {
    if (!initialAuditResult) return {};
    const map: Record<string, string> = {};
    initialAuditResult.questions.forEach((q) => {
      map[q.id] = "";
    });
    return map;
  });

  const [isAuditing, setIsAuditing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const auditTimerRef1 = useRef<NodeJS.Timeout | null>(null);
  const auditTimerRef2 = useRef<NodeJS.Timeout | null>(null);
  const synthTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger Stage 1: Multi-angle Audit
  const handleStartAudit = useCallback(async () => {
    const trimmed = rawProposal.trim();
    if (trimmed.length < 50) {
      toast.error(
        "Lütfen analiz için en az 50 karakter uzunluğunda bir tez metni veya taslak girin.",
      );
      return;
    }

    setIsAuditing(true);

    const steps: LoadingStep[] = PROPOSAL_AUDIT_STEPS.map((s, idx) => ({
      ...s,
      status: idx === 0 ? "active" : "idle",
    }));

    showLoading(
      "Çok Açılı Akademik Araştırma Yürütülüyor",
      "Tez öneriniz 3 farklı cepheden ayrıştırılarak YÖK tez arşivi (366k tez), uluslararası literatür ve güncel web veritabanlarında eşzamanlı taranıyor...",
      steps,
    );

    let isFinished = false;

    auditTimerRef1.current = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");
    }, 2500);

    auditTimerRef2.current = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "active");
    }, 6000);

    try {
      const res = await auditProposalAction(trimmed);
      isFinished = true;
      if (auditTimerRef1.current) clearTimeout(auditTimerRef1.current);
      if (auditTimerRef2.current) clearTimeout(auditTimerRef2.current);

      if ("error" in res) {
        hideLoading();
        toast.error(res.error);
        return;
      }

      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "completed");

      await new Promise((r) => setTimeout(r, 400));
      hideLoading();

      setAuditResult(res.result);
      const initialAnswerMap: Record<string, string> = {};
      res.result.questions.forEach((q) => {
        initialAnswerMap[q.id] = "";
      });
      setUserAnswers(initialAnswerMap);
      setStage("questions");
    } catch {
      isFinished = true;
      if (auditTimerRef1.current) clearTimeout(auditTimerRef1.current);
      if (auditTimerRef2.current) clearTimeout(auditTimerRef2.current);
      hideLoading();
      toast.error("Tez önerisi incelenirken beklenmeyen bir hata oluştu.");
    } finally {
      setIsAuditing(false);
    }
  }, [hideLoading, rawProposal, showLoading, updateLoadingStep]);

  // Trigger Stage 2: Synthesis, Persistence, and Navigation to Matrix Step
  const handleSynthesizeAndProceed = useCallback(async () => {
    if (!auditResult) return;

    const answersList: UserClarificationAnswer[] = auditResult.questions.map(
      (q) => ({
        question: q.question,
        answer:
          (userAnswers[q.id] ?? "").trim() ||
          "Araştırmacı tercihi genel akademik çerçeveye bırakıldı.",
      }),
    );

    setIsSynthesizing(true);

    const steps: LoadingStep[] = MATRIX_SYNTHESIS_STEPS.map((s, idx) => ({
      ...s,
      status: idx === 0 ? "active" : "idle",
    }));

    showLoading(
      "Nihai Tez Matrisi Sentezleniyor",
      "Orijinal metniniz, literatür kanıtları ve yanıtlarınız harmanlanarak 4 kadranlı akademik tez mimariniz oluşturuluyor...",
      steps,
    );

    let isFinished = false;

    synthTimerRef.current = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");
    }, 2000);

    try {
      const res = await synthesizeAndSaveMatrixAction({
        originalProposal: rawProposal,
        evidenceSummary: auditResult.evidenceSummary,
        userAnswers: answersList,
        auditResult,
      });
      isFinished = true;
      if (synthTimerRef.current) clearTimeout(synthTimerRef.current);

      if ("error" in res) {
        hideLoading();
        toast.error(res.error);
        return;
      }

      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "completed");

      await new Promise((r) => setTimeout(r, 400));
      hideLoading();

      await queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
      toast.success("Tez matrisi başarıyla sentezlendi ve kaydedildi.");
      router.push("/onboarding/matrix");
    } catch {
      isFinished = true;
      if (synthTimerRef.current) clearTimeout(synthTimerRef.current);
      hideLoading();
      toast.error("Matris sentezlenirken beklenmeyen bir hata oluştu.");
    } finally {
      setIsSynthesizing(false);
    }
  }, [
    auditResult,
    hideLoading,
    queryClient,
    rawProposal,
    router,
    showLoading,
    updateLoadingStep,
    userAnswers,
  ]);

  return (
    <div className="w-full space-y-6">
      {/* 1. STAGE: RAW INPUT */}
      {stage === "input" && (
        <div className="space-y-6">
          <AIBanner
            icon={Sparkles}
            variant="info"
            title="Çok Açılı Akademik Ön Değerlendirme Motoru"
            description="Tez öneriniz veya araştırma taslağınız; YÖK Ulusal Tez Merkezi (366k+ tez), uluslararası akademik literatür (OpenAlex) ve web veritabanları üzerinden taranarak güçlü yönleri ve metodolojik boşlukları analiz edilir."
          />

          <Card className="p-5 sm:p-6 space-y-4 rounded-md border border-border bg-card">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center size-5 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
                  01
                </span>
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <Label
                  htmlFor="rawProposal"
                  className="font-serif text-sm font-semibold text-foreground"
                >
                  Tez Önerisi veya Araştırma Taslağı Metni
                </Label>
              </div>
              <p className="font-sans text-xs text-muted-foreground leading-relaxed pl-7">
                Herhangi bir biçimlendirme kuralına bağlı kalmadan, çalışmanızın
                konusunu, merak ettiğiniz problemi, kuramsal yaklaşımınızı veya
                kaynakları içeren tüm metni buraya aktarın.
              </p>
            </div>

            <Textarea
              id="rawProposal"
              value={rawProposal}
              onChange={(e) => setRawProposal(e.target.value)}
              placeholder="Örnek: Bu çalışmada Türkiye'de uzaktan çalışan bilişim çalışanlarının ve dijital göçebelerin emek süreçlerindeki güvencesizleşme dinamiklerini incelemeyi hedefliyorum. Kuramsal olarak Standing'in prekarya yaklaşımı ve esneklik tartışmalarından yararlanarak, İstanbul ve sahil kentlerinde yaşayan 25 uzaktan bilişimci ile yarı yapılandırılmış derinlemesine mülakatlar yapmayı planlıyorum..."
              rows={14}
              className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  {rawProposal.trim().length} karakter
                </span>
                {rawProposal.trim().length > 0 &&
                  rawProposal.trim().length < 50 && (
                    <span className="text-xs text-warning font-medium">
                      (Analiz için en az 50 karakter gereklidir)
                    </span>
                  )}
              </div>

              <Button
                type="button"
                onClick={handleStartAudit}
                disabled={rawProposal.trim().length < 50 || isAuditing}
                size="lg"
                className="cursor-pointer"
              >
                <Search className="size-4 mr-2" />
                Web ve Tez Arşivini Tara, Analiz Et
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 2. STAGE: AUDIT REPORT & QUESTIONS */}
      {stage === "questions" && auditResult && (
        <div className="space-y-6">
          {/* Central AI Status Banner */}
          <AIBanner
            icon={CheckCircle2}
            variant="success"
            title="Tez Taslağınız Çok Açılı Akademik Taramayla İncelendi"
            description="YÖK Ulusal Tez Merkezi (366k+ tez), uluslararası literatür ve web veritabanları taranarak tez önerinizin güçlü yönleri ile metodolojik çerçevesi analiz edildi. Bulguları inceleyip 4 kadranlı tez mimarinizi oluşturabilirsiniz."
          />

          {/* Audited Sources Strip */}
          <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-md border border-border bg-card">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">
                Taranan Veri Tabanları:
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                <Library className="size-3 text-primary shrink-0" />
                YÖK Tez Arşivi
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                <BookOpen className="size-3 text-primary shrink-0" />
                OpenAlex Literatür
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                <Globe className="size-3 text-primary shrink-0" />
                Akademik Web
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono self-end sm:self-center">
              <span className="inline-flex size-2 rounded-full bg-primary animate-pulse" />
              <span>3 Kanallı Tarama Tamamlandı</span>
            </div>
          </Card>

          {/* Diagnostic Assessment Cards (2-Column Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tespit Edilen Güçlü Yönler */}
            <Card className="flex flex-col justify-between p-5 rounded-md border border-border bg-card space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center size-6 rounded-md bg-success/10 border border-success/20 text-success shrink-0">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
                      Tespit Edilen Güçlü Yönler
                    </h3>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                    Akademik Özgünlük
                  </span>
                </div>
                <p className="font-sans text-sm text-foreground leading-relaxed">
                  {auditResult.strengths}
                </p>
              </div>
            </Card>

            {/* Metodolojik Risk & Boşluk Tespiti */}
            <Card className="flex flex-col justify-between p-5 rounded-md border border-border bg-card space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center size-6 rounded-md bg-warning/10 border border-warning/20 text-warning shrink-0">
                      <AlertTriangle className="size-3.5" />
                    </div>
                    <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
                      Metodolojik Risk & Boşluk Tespiti
                    </h3>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                    Yöntemsel Analiz
                  </span>
                </div>
                <p className="font-sans text-sm text-foreground leading-relaxed">
                  {auditResult.diagnosticCritique}
                </p>
              </div>
            </Card>
          </div>

          {/* Clarification Questions / Scope Confirmation */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="space-y-0.5">
                <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
                  {auditResult.questions.length > 0
                    ? `Araştırma Odak Tercihleri (${auditResult.questions.length})`
                    : "Araştırma Çerçevesi"}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {auditResult.questions.length > 0
                    ? "Tez önerinizin kapsamını daraltmak veya kuramsal önceliklerinizi netleştirmek için aşağıdaki tercihleri belirtebilirsiniz."
                    : "Tez önerinizin araştırma kapsamı ve metodolojik sınırları yapay zeka taramasıyla doğrulanmıştır."}
                </p>
              </div>
              <span className="inline-flex items-center self-start sm:self-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border shrink-0">
                {auditResult.questions.length > 0
                  ? "Kapsam Tercihleri"
                  : "Odak Doğrulandı"}
              </span>
            </div>

            {auditResult.questions.length === 0 ? (
              <Card className="p-5 rounded-md border border-border bg-card space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center size-8 rounded-md bg-success/10 border border-success/20 text-success shrink-0 mt-0.5">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
                      Araştırma Çerçevesi Tutarlı ve Odaklı
                    </h3>
                    <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                      Tez önerinizde ek bir kapsam daraltması veya önceliklendirme
                      tercihi gerektiren bir belirsizlik bulunmadı. Doğrudan 4
                      kadranlı tez mimarinizi oluşturabilirsiniz.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {auditResult.questions.map((q, idx) => (
                  <Card
                    key={q.id}
                    className="p-5 rounded-md border border-border bg-card space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center size-5 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                          {q.categoryLabel}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-serif text-sm font-semibold text-foreground leading-snug">
                        {q.question}
                      </h3>
                      {q.contextNote && (
                        <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                          {q.contextNote}
                        </p>
                      )}
                    </div>

                    <Textarea
                      value={userAnswers[q.id] ?? ""}
                      onChange={(e) =>
                        setUserAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      placeholder="Bu soruya ilişkin tercihinizi kısaca belirtebilir veya genel çerçeveyle devam etmek için boş bırakabilirsiniz..."
                      rows={3}
                      className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
                    />
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 pb-8 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStage("input")}
              disabled={isSynthesizing}
            >
              <RotateCcw className="size-4 mr-2" />
              Öneriyi Baştan Düzenle
            </Button>

            <Button
              type="button"
              onClick={handleSynthesizeAndProceed}
              disabled={isSynthesizing}
              size="lg"
              className="cursor-pointer"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Tez Matrisi Sentezleniyor...
                </>
              ) : (
                <>
                  {auditResult.questions.length > 0
                    ? "Tercihleri Kaydet ve Tez Mimarisini Oluştur"
                    : "Tez Mimarisini Oluştur"}
                  <Sparkles className="size-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

