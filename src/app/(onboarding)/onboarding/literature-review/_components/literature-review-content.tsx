"use client";

import { Loader2, AlertCircle, BookOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AIBanner } from "@/components/shared/ai-banner";
import { LiteratureReviewSkeleton } from "./literature-review-skeleton";
import type { GeminiThesisBox, LiteraturePoolEntry } from "@/lib/types";
import { LiteratureArticleCard } from "./literature-article-card";
import {
  useLiteratureReview,
  type BoxStatus,
} from "../_hooks/use-literature-review";
import { getBoxTypeLabel } from "@/lib/box-constants";

/** Title of the dedicated related-theses box rendered at the bottom of the grid. */
const RELATED_THESES_TITLE = "İlgili Tezler";

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
      <div className="p-4 text-center border border-destructive/20 rounded-md bg-destructive/5 space-y-1">
        <AlertCircle className="size-5 text-destructive mx-auto" />
        <p className="text-xs text-destructive font-medium">Tarama hatası</p>
        <p className="text-[11px] text-muted-foreground">{errorMessage}</p>
      </div>
    );
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
    return (
      <div className="space-y-3">
        {childBoxes.length > 0 ? (
          <div className="relative border-l border-primary/20 pl-4 ml-3 space-y-4 pt-1">
            {childBoxes.map((sub, idx) => {
              const subEntry = literaturePool.find(
                (e) => e.subBoxTitle === sub.title,
              );
              const subArticles = subEntry?.articles ?? [];
              return (
                <div key={`${sub.title}-${idx}`} className="relative space-y-2">
                  <span className="absolute -left-[21.5px] top-1.5 size-2 rounded-full border-2 border-primary bg-background" />

                  <div className="space-y-0.5">
                    <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground leading-snug">
                      {sub.title}
                    </h3>
                    {sub.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed font-light">
                        {sub.description}
                      </p>
                    )}
                  </div>

                  {subArticles.length > 0 && (
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
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          entry &&
          entry.articles.length > 0 && (
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
          )
        )}
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

              <div className="space-y-0.5">
                <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground leading-snug">
                  {sub.title}
                </h3>
                {sub.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {sub.description}
                  </p>
                )}
                {sub.concepts && sub.concepts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {sub.concepts.map((concept, cIdx) => (
                      <span
                        key={`${concept}-${cIdx}`}
                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary font-medium"
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
    (box) =>
      box.boxType !== "RELATED_THESES" && box.title !== RELATED_THESES_TITLE,
  );

  if (loading) {
    return <LiteratureReviewSkeleton />;
  }

  return (
    <div className="w-full space-y-6">
      <AIBanner
        icon={BookOpen}
        title="Akademik Kaynak Taraması Aktif"
        description="Yapay zeka asistanınız her bir konu kutusu için akademik veri tabanlarını (Crossref, Semantic Scholar, TEZARA vb.) tarayarak başlangıç kaynaklarını derliyor."
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
            <Card key={subBox.title} className="p-5 space-y-3 rounded-md">
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
                  {subBox.title}
                </h2>
                {subBox.boxType && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary ml-auto">
                    {getBoxTypeLabel(subBox.boxType)}
                  </span>
                )}
              </div>
              {subBox.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">
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

        {(() => {
          const relatedThesesBox = subBoxes.find(
            (box) =>
              box.boxType === "RELATED_THESES" ||
              box.title === RELATED_THESES_TITLE,
          );
          const relatedThesesEntry = literaturePool.find(
            (e) =>
              e.subBoxTitle === RELATED_THESES_TITLE ||
              (relatedThesesBox &&
                (e.subBoxTitle === relatedThesesBox.title ||
                  e.thesisBoxId === relatedThesesBox.id)),
          );
          const relatedArticles = relatedThesesEntry?.articles ?? [];

          if (relatedArticles.length === 0) return null;

          const title = relatedThesesBox?.title ?? RELATED_THESES_TITLE;
          const description =
            relatedThesesBox?.description ??
            "Tez konunuz ve konumlandırmanız ile doğrudan ilişkili, incelenmesi önerilen YÖK ve akademik tez çalışmaları.";
          const boxType = relatedThesesBox?.boxType ?? "RELATED_THESES";

          return (
            <Card className="p-5 space-y-3 rounded-md">
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
                  {title}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary ml-auto">
                  {getBoxTypeLabel(boxType)}
                </span>
              </div>
              {description && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {description}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {relatedArticles.map((article, idx) => (
                  <LiteratureArticleCard
                    key={`${article.title}-${idx}`}
                    article={article}
                  />
                ))}
              </div>
            </Card>
          );
        })()}
      </div>

      <div className="flex justify-end mt-6 pb-8">
        <Button onClick={handleFinalize} disabled={confirming} size="lg">
          {confirming ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Onayla ve Tamamla
              <Check className="size-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}


