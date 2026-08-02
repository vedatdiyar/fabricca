"use client";

import { useState } from "react";
import {
  Loader2,
  AlertCircle,
  BookOpen,
  Archive,
  Plus,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AIBanner } from "@/components/ai-banner";
import { LoadingSpinner } from "@/components/loading-spinner";
import type { GeminiThesisBox, LiteraturePoolEntry } from "@/lib/types";
import { LiteratureArticleCard } from "./literature-article-card";
import {
  useLiteratureReview,
  type BoxStatus,
} from "../_hooks/use-literature-review";
import { getBoxTypeLabel } from "@/lib/box-constants";

/**
 * Renders a manual entry form for archival/empirical boxes.
 *
 * @param root0 - Component props.
 * @param root0.onAddEntry - Callback invoked with the entered title.
 * @returns The archive entry form UI.
 */
function ArchiveEntryForm({
  onAddEntry,
}: {
  onAddEntry: (title: string) => void;
}) {
  const [title, setTitle] = useState("");

  const handleAdd = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onAddEntry(trimmedTitle);
    setTitle("");
  };

  return (
    <div className="space-y-3 border border-dashed border-border rounded-md bg-card/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
        <Archive className="w-4 h-4 text-card-foreground" />
        <span>Birincil Kaynak / Veri Ekle</span>
      </div>
      <p className="text-xs text-card-foreground leading-relaxed font-light">
        Çalışmanızda kullandığınız birincil kaynak, mülakat, arşiv belgesi veya
        verinin adını girin.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Kaynak / belge / mülakat adı veya referansı"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          size="sm"
          onClick={handleAdd}
          disabled={!title.trim()}
        >
          <Plus className="w-4 h-4 mr-1" />
          Ekle
        </Button>
      </div>
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
  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 w-3/4 rounded bg-muted" />
        <div className="h-24 w-full rounded-md bg-muted/20" />
        <div className="h-24 w-full rounded-md bg-muted/20" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-6 text-center border border-destructive/20 rounded-md bg-destructive/5">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-destructive font-medium mb-1">
          Tarama hatası
        </p>
        <p className="text-xs text-muted-foreground mb-3">{errorMessage}</p>
      </div>
    );
  }

  return null;
}

/**
 * Renders completed sub-box results: manual entry forms for archival boxes, article grids otherwise.
 *
 * @param root0 - Component props.
 * @param root0.subBox - The completed sub-box data.
 * @param root0.literaturePool - The current literature pool entries.
 * @param root0.onAddArchiveEntry - Callback invoked when a manual archive entry is added.
 * @returns The completed sub-box results UI.
 */
function SubBoxDone({
  subBox,
  literaturePool,
  onAddArchiveEntry,
}: {
  subBox: GeminiThesisBox;
  literaturePool: LiteraturePoolEntry[];
  onAddArchiveEntry: (
    subBoxTitle: string,
    thesisBoxId: number,
    entry: { title: string },
  ) => void;
}) {
  const entry = literaturePool.find((e) => e.subBoxTitle === subBox.title);

  if (subBox.boxType === "PRIMARY_MATERIAL") {
    const childBoxes = subBox.subBoxes ?? [];
    return (
      <div className="space-y-4">
        {childBoxes.length > 0 ? (
          <div className="relative border-l border-primary/20 pl-4 ml-2.5 space-y-6 pt-2">
            {childBoxes.map((sub, idx) => {
              const subEntry = literaturePool.find(
                (e) => e.subBoxTitle === sub.title,
              );
              const subArticles = subEntry?.articles ?? [];
              return (
                <div key={`${sub.title}-${idx}`} className="relative space-y-3">
                  <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />

                  <div className="space-y-1">
                    <h3 className="font-serif text-lg font-medium tracking-tight text-foreground leading-snug">
                      {sub.title}
                    </h3>
                    {sub.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed font-light">
                        {sub.description}
                      </p>
                    )}
                  </div>

                  <ArchiveEntryForm
                    onAddEntry={(title) =>
                      onAddArchiveEntry(sub.title, sub.id ?? 0, { title })
                    }
                  />

                  {subArticles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {[...subArticles]
                        .sort(
                          (a, b) =>
                            Number(b.isFoundational) - Number(a.isFoundational),
                        )
                        .map((article, aIdx) => (
                          <LiteratureArticleCard
                            key={`${article.title}-${aIdx}`}
                            article={article}
                          />
                        ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center border border-dashed border-border/40 rounded-md bg-card/10">
                      <p className="text-xs text-muted-foreground font-light">
                        Bu alt başlık için henüz birincil belge/veri girilmedi.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <ArchiveEntryForm
              onAddEntry={(title) =>
                onAddArchiveEntry(subBox.title, subBox.id ?? 0, { title })
              }
            />
            {entry && entry.articles.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[...entry.articles]
                  .sort(
                    (a, b) =>
                      Number(b.isFoundational) - Number(a.isFoundational),
                  )
                  .map((article, idx) => (
                    <LiteratureArticleCard
                      key={`${article.title}-${idx}`}
                      article={article}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const childBoxes = subBox.subBoxes ?? [];
  if (childBoxes.length === 0) {
    if (!entry || entry.articles.length === 0) {
      return (
        <div className="p-6 text-center border border-dashed border-border rounded-md bg-card/20">
          <p className="text-sm text-muted-foreground">Kaynak bulunamadı.</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...entry.articles]
            .sort((a, b) => Number(b.isFoundational) - Number(a.isFoundational))
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
    <div className="space-y-4 pt-2">
      <div className="relative border-l border-primary/20 pl-4 ml-2.5 space-y-6">
        {childBoxes.map((sub, idx) => {
          const subEntry = literaturePool.find(
            (e) => e.subBoxTitle === sub.title,
          );
          const subArticles = subEntry?.articles ?? [];
          return (
            <div key={`${sub.title}-${idx}`} className="relative space-y-3">
              <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />

              <div className="space-y-1">
                <h3 className="font-serif text-lg font-medium tracking-tight text-foreground leading-snug">
                  {sub.title}
                </h3>
                {sub.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {sub.description}
                  </p>
                )}
                {sub.concepts && sub.concepts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {[...subArticles]
                    .sort(
                      (a, b) =>
                        Number(b.isFoundational) - Number(a.isFoundational),
                    )
                    .map((article, aIdx) => (
                      <LiteratureArticleCard
                        key={`${article.title}-${aIdx}`}
                        article={article}
                      />
                    ))}
                </div>
              ) : (
                <div className="p-3 text-center border border-dashed border-border/40 rounded-md bg-card/10">
                  <p className="text-xs text-muted-foreground">
                    Bu alt başlık için kaynak bulunamadı.
                  </p>
                </div>
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
    addArchiveEntry,
    handleFinalize,
  } = useLiteratureReview();

  if (loading) {
    return (
      <LoadingSpinner variant="full" message="Konu kutuları yükleniyor..." />
    );
  }
  return (
    <div className="w-full space-y-8">
      <AIBanner
        icon={BookOpen}
        title="Akademik Kaynak Taraması Aktif"
        description="Yapay zeka asistanınız her bir konu kutusu için akademik veri tabanlarını (Crossref, Semantic Scholar, TEZARA vb.) tarayarak başlangıç kaynaklarını derliyor."
      />

      <div className="grid grid-cols-1 gap-4">
        {subBoxes.map((subBox) => {
          const isArchival = archivalBoxes.has(subBox.title);
          const isCompleted = archivalBoxes.has(subBox.title)
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
            <Card key={subBox.title} className="p-6 space-y-4 rounded-md">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-primary/20" />
                <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                  {subBox.title}
                </h2>
                {subBox.boxType && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary ml-auto">
                    {getBoxTypeLabel(subBox.boxType)}
                  </span>
                )}
              </div>
              {subBox.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {subBox.description}
                </p>
              )}
              {isCompleted || isArchival ? (
                <SubBoxDone
                  subBox={subBox}
                  literaturePool={literaturePool}
                  onAddArchiveEntry={addArchiveEntry}
                />
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

      <div className="flex justify-end mt-8 pb-8">
        <Button onClick={handleFinalize} disabled={confirming} size="lg">
          {confirming ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Süreci Tamamla
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
