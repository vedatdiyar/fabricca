"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Archive, BookOpen, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AIBanner } from "@/components/shared/ai-banner";
import { OnboardingStepFooter } from "@/app/(onboarding)/onboarding/_components/onboarding-step-footer";
import { LiteratureReviewSkeleton } from "./literature-review-skeleton";
import type { GeminiThesisBox, LiteraturePoolEntry } from "@/lib/types";
import { LiteratureArticleCard } from "./literature-article-card";
import {
  useLiteratureReview,
  type BoxStatus,
} from "../_hooks/use-literature-review";
import { getBoxTypeLabel } from "@/lib/box-constants";

/**
 * Informational empty state for primary-material boxes that are excluded from auto-search.
 *
 * @returns The manual entry required banner.
 */
function ManualEntryRequiredCard() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center border border-dashed border-primary/20 rounded-md bg-primary/[0.04]">
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
        <Archive className="size-5 text-primary" />
      </div>
      <p className="font-sans text-xs leading-relaxed text-muted-foreground max-w-lg">
        Bu alan birincil kaynaklar (arşiv belgeleri, saha notları, kurum içi
        veriler) için ayrılmıştır. Otomatik taranmaz; belgelerinizi doğrudan
        sisteme ekleyebilirsiniz.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-1 gap-1.5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
        onClick={() => router.push("/library")}
      >
        <Plus className="size-3.5" />
        Kaynak Ekle
      </Button>
    </div>
  );
}

/**
 * Renders a sub-box's transient processing states while the pipeline runs.
 *
 * @param root0 - Component props.
 * @param root0.status - The current processing status of the sub-box.
 * @param root0.errorMessage - Optional error message shown on failure.
 * @returns The processing state UI or null when idle.
 */
function SubBoxQuery({
  status,
  errorMessage,
}: {
  status: BoxStatus;
  errorMessage?: string;
}) {
  if (status === "idle" || status === "loading") {
    return (
      <div className="space-y-2.5 animate-pulse pt-1">
        <div className="h-4 w-1/3 rounded bg-muted/40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="h-16 rounded-md bg-muted/20 border border-border/40" />
          <div className="h-16 rounded-md bg-muted/20 border border-border/40" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-4 text-center border border-destructive/20 rounded-md bg-destructive/10 space-y-1.5">
        <AlertCircle className="size-5 text-destructive mx-auto" />
        <p className="text-xs text-destructive font-medium">Tarama hatası</p>
        <p className="font-sans text-xs text-muted-foreground">
          {errorMessage}
        </p>
      </div>
    );
  }

  if (status === "manual_entry_required") {
    return <ManualEntryRequiredCard />;
  }

  return null;
}

/**
 * Renders completed sub-box results as article grids.
 *
 * @param root0 - Component props.
 * @param root0.subBox - The completed sub-box data.
 * @param root0.literaturePool - The current literature pool entries.
 * @returns The completed sub-box results UI.
 */
function SubBoxDone({
  subBox,
  literaturePool,
}: {
  subBox: GeminiThesisBox;
  literaturePool: LiteraturePoolEntry[];
}) {
  const entry = literaturePool.find((e) => e.subBoxTitle === subBox.title);

  if (subBox.boxType === "PRIMARY_MATERIAL") {
    const childBoxes = subBox.subBoxes ?? [];
    // Parent-level manual flag (also covers reload case where pool row absent)
    const isParentManual =
      entry?.status === "manual_entry_required" ||
      (!entry && subBox.boxType === "PRIMARY_MATERIAL");

    if (childBoxes.length > 0) {
      return (
        <div className="space-y-3">
          <div className="relative border-l border-primary/20 pl-4 ml-3 space-y-4 pt-1">
            {childBoxes.map((sub, idx) => {
              const subEntry = literaturePool.find(
                (e) => e.subBoxTitle === sub.title,
              );
              const subArticles = subEntry?.articles ?? [];
              const isChildManual =
                subEntry?.status === "manual_entry_required" ||
                (!subEntry && subBox.boxType === "PRIMARY_MATERIAL");
              return (
                <div key={`${sub.title}-${idx}`} className="relative space-y-2">
                  <span className="absolute -left-[21.5px] top-1.5 size-2 rounded-full border-2 border-primary bg-background" />

                  <div className="space-y-0.5">
                    <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground leading-snug">
                      {sub.title}
                    </h3>
                    {sub.description && (
                      <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                        {sub.description}
                      </p>
                    )}
                  </div>

                  {isChildManual ? (
                    <ManualEntryRequiredCard />
                  ) : subArticles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {[...subArticles]
                        .sort((a, b) => b.relevanceScore - a.relevanceScore)
                        .map((article, aIdx) => (
                          <LiteratureArticleCard
                            key={`${article.title}-${aIdx}`}
                            article={article}
                          />
                        ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // No child boxes — parent itself is the manual box
    if (isParentManual) {
      return (
        <div className="space-y-3">
          <ManualEntryRequiredCard />
          {entry && entry.articles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...entry.articles]
                .sort((a, b) => b.relevanceScore - a.relevanceScore)
                .map((article, idx) => (
                  <LiteratureArticleCard
                    key={`${article.title}-${idx}`}
                    article={article}
                  />
                ))}
            </div>
          )}
        </div>
      );
    }

    if (entry && entry.articles.length > 0) {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...entry.articles]
              .sort((a, b) => b.relevanceScore - a.relevanceScore)
              .map((article, idx) => (
                <LiteratureArticleCard
                  key={`${article.title}-${idx}`}
                  article={article}
                />
              ))}
          </div>
        </div>
      );
    }

    // Fallback — should not be reached for manual boxes but keeps empty safety net
    return (
      <div className="space-y-3">
        <ManualEntryRequiredCard />
      </div>
    );
  }

  const childBoxes = subBox.subBoxes ?? [];
  if (childBoxes.length === 0) {
    if (!entry || entry.articles.length === 0) {
      return (
        <Card className="p-4 text-center border border-dashed border-border rounded-md">
          <p className="text-xs text-muted-foreground">Kaynak bulunamadı.</p>
        </Card>
      );
    }
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...entry.articles]
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .map((article, idx) => (
              <LiteratureArticleCard
                key={`${article.title}-${idx}`}
                article={article}
              />
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="relative border-l border-primary/20 pl-4 ml-3 space-y-4">
        {childBoxes.map((sub, idx) => {
          const subEntry = literaturePool.find(
            (e) => e.subBoxTitle === sub.title,
          );
          const subArticles = subEntry?.articles ?? [];
          return (
            <div key={`${sub.title}-${idx}`} className="relative space-y-2">
              <span className="absolute -left-[21.5px] top-1.5 size-2 rounded-full border-2 border-primary bg-background" />

              <div className="space-y-1">
                <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground leading-snug">
                  {sub.title}
                </h3>
                {sub.description && (
                  <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                    {sub.description}
                  </p>
                )}
                {sub.concepts && sub.concepts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {sub.concepts.map((concept, cIdx) => (
                      <span
                        key={`${concept}-${cIdx}`}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border text-xs font-medium"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {subArticles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {[...subArticles]
                    .sort((a, b) => b.relevanceScore - a.relevanceScore)
                    .map((article, aIdx) => (
                      <LiteratureArticleCard
                        key={`${article.title}-${aIdx}`}
                        article={article}
                      />
                    ))}
                </div>
              ) : (
                <Card className="p-3 text-center border border-dashed border-border/40 rounded-md">
                  <p className="text-xs text-muted-foreground">
                    Bu alt başlık için kaynak bulunamadı.
                  </p>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Top-level literature-review container delegating orchestration to the useLiteratureReview hook.
 *
 * @returns The literature review content UI.
 */
export function LiteratureReviewContent() {
  const router = useRouter();
  const {
    subBoxes,
    loading,
    confirming,
    boxStatuses,
    boxErrors,
    archivalBoxes,
    literaturePool,
    handleFinalize,
  } = useLiteratureReview();

  const regularBoxes = subBoxes.filter(
    (box) => box.boxType !== "RELATED_THESES",
  );

  if (loading) {
    return <LiteratureReviewSkeleton />;
  }

  return (
    <div className="w-full space-y-6">
      <AIBanner
        icon={BookOpen}
        title="Akademik Kaynak Taraması Aktif"
        description="Yapay zeka asistanınız her bir konu kutusu için akademik veri tabanlarını (OpenAlex, ulusal tez arşivi vb.) tarayarak başlangıç kaynaklarını derliyor."
      />

      <div className="grid grid-cols-1 gap-4">
        {regularBoxes.map((subBox) => {
          const isArchival = archivalBoxes.has(subBox.title);
          const isCompleted = isArchival
            ? false
            : (subBox.subBoxes?.length ?? 0) > 0
              ? subBox.subBoxes!.some((child) =>
                  literaturePool.some(
                    (e) =>
                      e.subBoxTitle === child.title && e.articles.length > 0,
                  ),
                )
              : literaturePool.some(
                  (e) =>
                    e.subBoxTitle === subBox.title && e.articles.length > 0,
                );

          return (
            <Card
              key={subBox.title}
              className="p-5 sm:p-6 space-y-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
                  {subBox.title}
                </h2>
                {subBox.boxType && (
                  <Badge
                    variant="secondary"
                    className="px-2.5 py-0.5 rounded-md text-xs font-medium ml-auto"
                  >
                    {getBoxTypeLabel(subBox.boxType)}
                  </Badge>
                )}
              </div>
              {subBox.description && (
                <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                  {subBox.description}
                </p>
              )}
              {isCompleted || isArchival ? (
                <SubBoxDone subBox={subBox} literaturePool={literaturePool} />
              ) : (
                <SubBoxQuery
                  status={boxStatuses[subBox.title] ?? "idle"}
                  errorMessage={boxErrors[subBox.title]}
                />
              )}
            </Card>
          );
        })}
      </div>

      <OnboardingStepFooter
        onBack={() => router.push("/onboarding/outline")}
        backLabel="Tez Planına Dön"
        backDisabled={confirming}
        onNext={handleFinalize}
        nextLabel="Onayla ve Tamamla"
        nextDisabled={confirming}
        nextLoading={confirming}
        nextLoadingText="Kaydediliyor..."
        isLastStep={true}
      />
    </div>
  );
}
