"use client";

import React, { useState, useCallback, useRef, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, FileText, Search, Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AIBanner } from "@/components/shared/ai-banner";
import { useLoadingOverlay } from "@/core/providers/loading-overlay-provider";
import {
  PROPOSAL_POSITIONING_STEPS,
  type LoadingStep,
} from "@/app/(onboarding)/onboarding/_services/loading-steps";
import { startOnboardingFromProposalAction } from "@/app/(onboarding)/onboarding/positioning/actions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface ProposalStudioProps {
  initialProposal?: string;
}

const proposalPreviewComponents: Components = {
  h1: ({ children }) => (
    <h1 className="font-serif text-xl font-semibold tracking-tight leading-tight text-foreground mt-3 mb-1.5 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-serif text-base font-semibold tracking-tight text-foreground mt-3 mb-1 pt-2 border-t border-foreground/10 first:mt-0 first:pt-0 first:border-t-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground mt-3 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  // Editorial hierarchy fix:
  // **Primary Sources** / **Secondary Sources** gibi tek kalın paragraf → h3
  // *Örgütsel Belgeler* / *Legal Parti Belgeleri* gibi tek italik paragraf → h4
  p: ({ children }) => {
    const arr = React.Children.toArray(children);
    if (arr.length === 1 && React.isValidElement(arr[0])) {
      const el = arr[0] as React.ReactElement<{
        children?: React.ReactNode;
        node?: { tagName?: string };
      }>;
      const inner = el.props.children;
      const text =
        typeof inner === "string"
          ? inner.trim()
          : Array.isArray(inner)
            ? inner.join("").trim()
            : "";
      const tagName =
        (el.props as { node?: { tagName?: string } }).node?.tagName ??
        (typeof el.type === "function"
          ? (el.type as { name?: string }).name
          : undefined) ??
        (typeof el.type === "string" ? el.type : undefined);
      const isShortHeading =
        text.length > 0 && text.length < 80 && !text.includes("  ");
      if (isShortHeading) {
        if (tagName === "strong") {
          return (
            <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground mt-3 mb-1">
              {text}
            </h3>
          );
        }
        if (tagName === "em") {
          return (
            <h4 className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2.5 mb-1">
              {text}
            </h4>
          );
        }
      }
    }
    return (
      <p className="text-sm leading-relaxed text-foreground mb-2 last:mb-0">
        {children}
      </p>
    );
  },
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1 my-2 text-sm text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1 my-2 text-sm text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed text-foreground">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/30 bg-primary/5 py-1.5 px-3 my-2 rounded-r-md text-sm text-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 rounded-md border border-border">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left p-2 font-medium border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="p-2 border-b border-border/60">{children}</td>
  ),
  hr: () => <hr className="my-3 border-border/20" />,
  code: ({ children }) => (
    <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted border border-border text-foreground">
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

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
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  const deferredProposal = useDeferredValue(rawProposal);

  const auditTimerRef1 = useRef<NodeJS.Timeout | null>(null);
  const auditTimerRef2 = useRef<NodeJS.Timeout | null>(null);
  const auditTimerRef3 = useRef<NodeJS.Timeout | null>(null);

  const handleStartAnalysis = useCallback(async () => {
    const trimmed = rawProposal.trim();
    if (trimmed.length < 50) {
      toast.error(
        "Lütfen analiz için en az 50 karakter uzunluğunda bir tez taslağı veya öneri metni girin.",
      );
      return;
    }

    setIsAuditing(true);

    const steps: LoadingStep[] = PROPOSAL_POSITIONING_STEPS.map((s, idx) => ({
      ...s,
      status: idx === 0 ? "active" : "idle",
    }));

    showLoading(
      "4 Kanallı Akademik Konumlandırma Yürütülüyor",
      "Tez taslağınız; YÖK Tez Merkezi (366k tez), küresel literatür (OpenAlex, Semantic Scholar) ve DergiPark/web veritabanlarında taranıyor, jüri analizi hazırlanıyor...",
      steps,
    );

    let isFinished = false;

    auditTimerRef1.current = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");
    }, 1800);

    auditTimerRef2.current = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "active");
    }, 4800);

    auditTimerRef3.current = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(2, "completed");
      updateLoadingStep(3, "active");
    }, 8500);

    try {
      const res = await startOnboardingFromProposalAction(trimmed);
      isFinished = true;
      if (auditTimerRef1.current) clearTimeout(auditTimerRef1.current);
      if (auditTimerRef2.current) clearTimeout(auditTimerRef2.current);
      if (auditTimerRef3.current) clearTimeout(auditTimerRef3.current);

      if ("error" in res) {
        hideLoading();
        toast.error(res.error);
        return;
      }

      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "completed");
      updateLoadingStep(3, "completed");

      await new Promise((r) => setTimeout(r, 400));
      hideLoading();

      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
      toast.success("Akademik konumlandırma raporu hazırlandı.");
      router.push("/onboarding/positioning");
    } catch {
      isFinished = true;
      if (auditTimerRef1.current) clearTimeout(auditTimerRef1.current);
      if (auditTimerRef2.current) clearTimeout(auditTimerRef2.current);
      if (auditTimerRef3.current) clearTimeout(auditTimerRef3.current);
      hideLoading();
      toast.error("Tez önerisi incelenirken beklenmeyen bir hata oluştu.");
    } finally {
      setIsAuditing(false);
    }
  }, [
    hideLoading,
    queryClient,
    rawProposal,
    router,
    showLoading,
    updateLoadingStep,
  ]);

  return (
    <div className="w-full space-y-4">
      <AIBanner
        icon={Sparkles}
        variant="info"
        title="Akademik Konumlandırma"
        description="Taslağınız literatürle karşılaştırılır, özgünlük boşluğunuz ve konumunuz belirlenir."
      />

      <Card className="p-5 sm:p-6 space-y-4 rounded-md border border-border bg-card">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center justify-between gap-3 flex-wrap">
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
            <div className="flex items-center gap-1 rounded-md bg-muted p-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("write")}
                className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "write"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Pencil className="size-3.5" />
                Yaz
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "preview"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="size-3.5" />
                Önizleme
              </button>
            </div>
          </div>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed pl-7">
            Herhangi bir biçimlendirme kuralına bağlı kalmadan; çalışmanızın
            konusunu, merak ettiğiniz problemi, kuramsal yaklaşımınızı veya veri
            kaynaklarınızı içeren metni buraya aktarın.
          </p>
        </div>

        {activeTab === "write" ? (
          <Textarea
            id="rawProposal"
            value={rawProposal}
            onChange={(e) => setRawProposal(e.target.value)}
            placeholder="Örnek: Bu çalışmada Türkiye'de uzaktan çalışan bilişim çalışanlarının ve dijital göçebelerin emek süreçlerindeki güvencesizleşme dinamiklerini incelemeyi hedefliyorum. Kuramsal olarak Standing'in prekarya yaklaşımı ve Foucault'nun öznellik tartışmalarından yararlanarak, İstanbul ve sahil kentlerinde yaşayan 25 uzaktan bilişimci ile yarı yapılandırılmış derinlemesine mülakatlar yapmayı planlıyorum..."
            rows={13}
            className="min-h-[280px] border-border text-sm leading-relaxed"
          />
        ) : (
          <div className="min-h-[280px] w-full rounded-md border border-border bg-background px-3 py-2.5 overflow-auto">
            {rawProposal.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={proposalPreviewComponents}
              >
                {deferredProposal}
              </ReactMarkdown>
            ) : (
              <p className="text-sm text-muted-foreground/60">
                Önizleme için önce Yaz sekmesine metin girin veya yapıştırın.
              </p>
            )}
          </div>
        )}

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
            onClick={handleStartAnalysis}
            disabled={rawProposal.trim().length < 50 || isAuditing}
            size="lg"
            className="cursor-pointer"
          >
            <Search className="size-4 mr-2" />
            Raporu Oluştur
          </Button>
        </div>
      </Card>
    </div>
  );
}
