"use client";

import React, { useState, useDeferredValue, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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

/**
 * Counts words accurately by splitting on consecutive whitespace characters.
 *
 * @param text - Plain text input string.
 * @returns Number of words.
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const proposalPreviewComponents: Components = {
  h1: ({ children }) => (
    <h1 className="font-serif text-xl font-semibold tracking-tight leading-snug text-foreground mt-6 mb-3 first:mt-0 pb-2 border-b border-input">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-serif text-base font-semibold tracking-tight text-foreground mt-6 mb-2.5 pt-3 border-t border-input first:mt-0 first:pt-0 first:border-t-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground mt-5 mb-2 first:mt-0">
      {children}
    </h3>
  ),
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
        text.length > 0 && text.length < 90 && !text.includes("  ");
      if (isShortHeading) {
        if (tagName === "strong") {
          return (
            <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground mt-5 mb-2">
              {text}
            </h3>
          );
        }
        if (tagName === "em") {
          return (
            <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-1.5">
              {text}
            </h4>
          );
        }
      }
    }
    return (
      <p className="text-sm leading-relaxed text-foreground mb-3.5 last:mb-0">
        {children}
      </p>
    );
  },
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1.5 my-3 text-sm text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1.5 my-3 text-sm text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed text-foreground">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 bg-primary/10 py-2 px-3.5 my-3 rounded-r-md text-sm italic text-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-md border border-border/60 bg-card/40">
      <table className="w-full text-xs border-collapse divide-y divide-border/60">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50 text-foreground font-medium text-xs">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="text-left px-3.5 py-2.5 font-medium border-b border-border/60 text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3.5 py-2.5 border-b border-border/40 text-foreground leading-normal align-top">
      {children}
    </td>
  ),
  hr: () => <hr className="my-5 border-input" />,
  code: ({ children }) => (
    <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary transition-colors"
    >
      {children}
    </a>
  ),
};

/**
 * Onboarding Step 1: Proposal Studio.
 * Seamless, distraction-free document surface.
 * When typing/editing: zero-border clean writing area.
 * When rendered: beautiful academic paper with Serif typography and styled tables.
 *
 * @param props - Initial proposal text if previously saved.
 * @returns The rendered ProposalStudio.
 */
export function ProposalStudio({ initialProposal = "" }: ProposalStudioProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading, updateLoadingStep } = useLoadingOverlay();

  const [rawProposal, setRawProposal] = useState(initialProposal);
  const [isEditing, setIsEditing] = useState(!initialProposal.trim());
  const [isAuditing, setIsAuditing] = useState(false);
  const proposalInputRef = useRef<HTMLTextAreaElement>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (isEditing) proposalInputRef.current?.focus();
  }, [isEditing]);

  const deferredProposal = useDeferredValue(rawProposal);
  const wordCount = countWords(rawProposal);
  const hasProposal = rawProposal.trim().length > 0;
  const hasMinWords = wordCount >= 10;

  const handleStartAnalysis = async () => {
    const trimmed = rawProposal.trim();
    if (trimmed.length < 50) {
      toast.error(
        "Lütfen analiz için en az 50 karakter ve yeterli kelime uzunluğunda bir tez taslağı girin.",
      );
      return;
    }

    setIsAuditing(true);

    const steps: LoadingStep[] = PROPOSAL_POSITIONING_STEPS.map((s, idx) => ({
      ...s,
      status: idx === 0 ? "active" : "idle",
    }));

    showLoading(
      "Akademik Konumlandırma Yürütülüyor",
      "Tez taslağınız; YÖK Tez Merkezi (366k tez), küresel literatür (OpenAlex) ve DergiPark/web veritabanlarında taranıyor, jüri analizi hazırlanıyor...",
      steps,
    );

    let isFinished = false;

    const timer1 = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");
    }, 1800);

    const timer2 = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "active");
    }, 4800);

    const timer3 = setTimeout(() => {
      if (isFinished) return;
      updateLoadingStep(2, "completed");
      updateLoadingStep(3, "active");
    }, 8500);

    try {
      const res = await startOnboardingFromProposalAction(trimmed);
      isFinished = true;
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

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
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      hideLoading();
      toast.error("Tez önerisi incelenirken beklenmeyen bir hata oluştu.");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <Card className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
        {/* Studio Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-card/60">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center size-5 rounded bg-primary/10 border border-primary/20 text-primary font-mono text-xs font-semibold">
                01
              </span>
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <Label className="font-serif text-sm font-semibold text-foreground tracking-tight">
                Tez Taslağı & Araştırma Metni
              </Label>
            </div>

            {hasProposal && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRawProposal("");
                  setIsEditing(true);
                }}
              >
                <RotateCcw className="size-3.5" />
                <span>Temizle</span>
              </Button>
            )}
          </div>

          <p className="font-sans text-xs text-muted-foreground leading-relaxed pl-7.5 mt-1">
            {hasProposal && !isEditing
              ? "Taslağınız döküman görünümünde. Düzenlemek için dökümana tıklayabilirsiniz."
              : "Tez konunuzu doğrudan yazabilir veya ChatGPT, Claude, Word'den kopyalayıp yapıştırabilirsiniz."}
          </p>
        </div>

        {/* Studio Content Area (Pure Paper Viewport) */}
        <div className="relative flex-1">
          <div className="h-[calc(100vh-380px)] min-h-[420px] max-h-[640px] w-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 sm:px-12 py-8 text-foreground min-h-full">
              {isEditing || !hasProposal ? (
                <textarea
                  ref={proposalInputRef}
                  id="proposal-input"
                  value={rawProposal}
                  onChange={(e) => setRawProposal(e.target.value)}
                  onBlur={() => {
                    if (rawProposal.trim()) {
                      setIsEditing(false);
                    }
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (pasted.trim().length > 60) {
                      setTimeout(() => {
                        setIsEditing(false);
                      }, 50);
                    }
                  }}
                  placeholder="Tezinizin konusunu, merak ettiğiniz problemi veya araştırma taslağınızı buraya yazın ya da kopyaladığınız metni yapıştırın..."
                  aria-label="Tez taslağı ve araştırma metni"
                  className="w-full min-h-[400px] h-full bg-transparent text-sm leading-relaxed font-sans text-foreground placeholder:text-muted-foreground border-0 outline-none resize-none focus:outline-none focus:ring-0 p-0 m-0"
                />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Taslağı düzenlemek için tıklayın"
                  onClick={() => setIsEditing(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsEditing(true);
                    }
                  }}
                  className="cursor-text min-h-[400px] group transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
                  title="Düzenlemek için tıklayın"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={proposalPreviewComponents}
                  >
                    {deferredProposal}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Studio Permanent Footer Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-t border-border/60 bg-card/90">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {wordCount.toLocaleString("tr-TR")}
              </span>
              kelime
            </span>
            {hasProposal && !hasMinWords && (
              <span className="text-xs text-warning font-medium">
                (Analiz için en az 10 kelimelik bir taslak gereklidir)
              </span>
            )}
          </div>

          <Button
            type="button"
            onClick={handleStartAnalysis}
            disabled={
              !hasProposal ||
              !hasMinWords ||
              rawProposal.trim().length < 50 ||
              isAuditing
            }
            size="lg"
          >
            <Search className="size-4" />
            <span>Raporu Oluştur</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
