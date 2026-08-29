"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AIBanner } from "@/components/shared/ai-banner";
import { useLoadingOverlay } from "@/core/providers/loading-overlay-provider";
import type { LoadingStep } from "@/app/(onboarding)/onboarding/_services/loading-steps";
import { startOnboardingFromProposalAction } from "@/app/(onboarding)/onboarding/positioning/actions";

interface ProposalStudioProps {
  initialProposal?: string;
}

const ONBOARDING_AUDIT_STEPS: LoadingStep[] = [
  {
    text: "Tez taslağınız akademik olarak ayrıştırılıyor ve arka plan mimarisi kuruluyor...",
    status: "active",
  },
  {
    text: "4 kanallı literatür taranıyor (YÖK 366k Tez, OpenAlex, Semantic Scholar, DergiPark/Exa)...",
    status: "idle",
  },
  {
    text: "Cohere Rerank ve akademik konumlandırma jürisi çalıştırılıyor...",
    status: "idle",
  },
];

/**
 * Onboarding Step 1: Proposal intake and launchpad for the 4-channel academic positioning jury.
 *
 * @param props - Initial proposal text if previously saved.
 * @returns The rendered ProposalStudio.
 */
export function ProposalStudio({ initialProposal = "" }: ProposalStudioProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading, updateLoadingStep } = useLoadingOverlay();

  const [rawProposal, setRawProposal] = useState(initialProposal);
  const [isAuditing, setIsAuditing] = useState(false);

  const auditTimerRef1 = useRef<NodeJS.Timeout | null>(null);
  const auditTimerRef2 = useRef<NodeJS.Timeout | null>(null);

  const handleStartAnalysis = useCallback(async () => {
    const trimmed = rawProposal.trim();
    if (trimmed.length < 50) {
      toast.error(
        "Lütfen analiz için en az 50 karakter uzunluğunda bir tez taslağı veya öneri metni girin.",
      );
      return;
    }

    setIsAuditing(true);

    const steps: LoadingStep[] = ONBOARDING_AUDIT_STEPS.map((s, idx) => ({
      ...s,
      status: idx === 0 ? "active" : "idle",
    }));

    showLoading(
      "4 Kanallı Akademik Araştırma & Konumlandırma Yürütülüyor",
      "Tez taslağınız; YÖK Tez Merkezi (366k tez), küresel literatür (OpenAlex, Semantic Scholar) ve DergiPark/web veritabanlarında eşzamanlı taranıyor, jüri analizi hazırlanıyor...",
      steps,
    );

    let isFinished = false;

    auditTimerRef1.current = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");
    }, 2200);

    auditTimerRef2.current = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "active");
    }, 5500);

    try {
      const res = await startOnboardingFromProposalAction(trimmed);
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

      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
      toast.success("Akademik konumlandırma raporu hazırlandı.");
      router.push("/onboarding/positioning");
    } catch {
      isFinished = true;
      if (auditTimerRef1.current) clearTimeout(auditTimerRef1.current);
      if (auditTimerRef2.current) clearTimeout(auditTimerRef2.current);
      hideLoading();
      toast.error("Tez önerisi incelenirken beklenmeyen bir hata oluştu.");
    } finally {
      setIsAuditing(false);
    }
  }, [hideLoading, queryClient, rawProposal, router, showLoading, updateLoadingStep]);

  return (
    <div className="w-full space-y-6">
      <AIBanner
        icon={Sparkles}
        variant="info"
        title="4 Kanallı Akademik Konumlandırma ve Özgünlük Motoru"
        description="Tez taslağınız veya araştırma fikriniz; YÖK Ulusal Tez Merkezi (366k+ tez), uluslararası literatür (OpenAlex, Semantic Scholar) ve DergiPark veritabanları taranarak emsal çalışmalar, özgünlük boşluğu ve yöntemsel desenleriyle analiz edilir."
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
              Tez Taslağı, Araştırma Problemi veya Öneri Metni
            </Label>
          </div>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed pl-7">
            Herhangi bir biçimlendirme kuralına bağlı kalmadan; çalışmanızın konusunu, merak ettiğiniz
            problemi, kuramsal yaklaşımınızı veya veri kaynaklarınızı içeren metni buraya aktarın.
          </p>
        </div>

        <Textarea
          id="rawProposal"
          value={rawProposal}
          onChange={(e) => setRawProposal(e.target.value)}
          placeholder="Örnek: Bu çalışmada Türkiye'de uzaktan çalışan bilişim çalışanlarının ve dijital göçebelerin emek süreçlerindeki güvencesizleşme dinamiklerini incelemeyi hedefliyorum. Kuramsal olarak Standing'in prekarya yaklaşımı ve Foucault'nun öznellik tartışmalarından yararlanarak, İstanbul ve sahil kentlerinde yaşayan 25 uzaktan bilişimci ile yarı yapılandırılmış derinlemesine mülakatlar yapmayı planlıyorum..."
          rows={12}
          className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
        />

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">
              {rawProposal.trim().length} karakter
            </span>
            {rawProposal.trim().length > 0 && rawProposal.trim().length < 50 && (
              <span className="text-xs text-warning font-medium">
                (Analiz için en az 50 karakter gereklidir)
              </span>
            )}
          </div>

          <Button
            type="button"
            onClick={handleStartAnalysis}
            disabled={rawProposal.trim().length < 50 || isAuditing}
            size="lg"
            className="cursor-pointer"
          >
            <Search className="size-4 mr-2" />
            4 Kanallı Literatürü Tara & Konumlandır
          </Button>
        </div>
      </Card>
    </div>
  );
}
