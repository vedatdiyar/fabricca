"use client";

import { useState } from "react";
import { Loader2, AlertCircle, BookOpen, Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AIBanner } from "@/components/ai-banner";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { GeminiThesisBox } from "@/lib/types";
import { LiteratureArticleCard } from "./literature-article-card";
import {
  useLiteratureReview,
  type BoxStatus,
} from "../_hooks/use-literature-review";

/**
 * Renders a manual entry form for archival/empirical boxes so the user can
 * input primary archive fund codes (e.g. BCA, TBMM Zabıtları) directly.
 */
function ArchiveEntryForm({
  onAddEntry,
}: {
  onAddEntry: (title: string, description: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleAdd = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onAddEntry(trimmedTitle, description.trim());
    setTitle("");
    setDescription("");
  };

  return (
    <div className="space-y-3 border border-dashed border-border rounded-md bg-card/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
        <Archive className="w-4 h-4 text-card-foreground" />
        <span>Birincil Arşiv Belgesi Ekle</span>
      </div>
      <p className="text-xs text-card-foreground leading-relaxed">
        Arşiv fon kodunu veya belge adını girin (Örn: BCA, Fon Kodu: 30.10; TBMM
        Zabıtları, Cilt: 12).
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Arşiv fon kodu / belge adı"
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
      <Textarea
        placeholder="Belge açıklaması (isteğe bağlı)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-[60px] resize-none overflow-y-auto text-sm"
      />
    </div>
  );
}

/**
 * Renders a single sub-box's transient processing states (loading skeleton,
 * error, idle) while the review pipeline runs.
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
 * Renders the completed results for a sub-box. For archival/empirical boxes,
 * shows a manual entry form (if empty) or the list of manually-entered archive
 * entries. For standard boxes, renders the starter pack and reserved pool.
 */
function SubBoxDone({
  subBox,
  onAddArchiveEntry,
}: {
  subBox: GeminiThesisBox;
  onAddArchiveEntry: (
    subBoxTitle: string,
    entry: { title: string; description?: string },
  ) => void;
}) {
  const literaturePool = useOnboardingStore((s) => s.literaturePool);
  const entry = literaturePool.find((e) => e.subBoxTitle === subBox.title);

  /* PRIMARY_MATERIAL boxes get a manual archive-entry form */
  if (subBox.boxType === "PRIMARY_MATERIAL") {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-md bg-primary/10 border border-primary/20 leading-relaxed">
          <p className="font-medium text-foreground text-sm mb-1">
            Birincil Malzeme Alanı
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Bu alan, yapacağınız saha çalışması verileri (mülakat deşifreleri,
            anketler) veya kütüphanelerden toplayacağınız birincil kaynaklar
            (gazete, doküman, arşiv belgeleri) için ayrılmış size özel bir veri
            havuzudur. Onboarding tamamlandıktan sonra kendi belgelerinizi
            buraya yükleyebilirsiniz.
          </p>
        </div>
        <ArchiveEntryForm
          onAddEntry={(title, desc) =>
            onAddArchiveEntry(subBox.title, { title, description: desc })
          }
        />
        {entry && entry.articles.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-success/10 border border-success/20">
              <Archive className="w-4 h-4 text-success shrink-0" />
              <p className="text-xs text-success font-medium">
                <span className="font-semibold">{entry.articles.length}</span>{" "}
                birincil arşiv belgesi eklendi.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {entry.articles.map((article, idx) => (
                <LiteratureArticleCard
                  key={`${article.title}-${idx}`}
                  article={article}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  /* Standard boxes (including RELATED_THESES): show entries or empty state */
  if (!entry || entry.articles.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed border-border rounded-md bg-card/20">
        <p className="text-sm text-muted-foreground">Kaynak bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {entry.articles.map((article, idx) => (
          <LiteratureArticleCard
            key={`${article.title}-${idx}`}
            article={article}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Top-level literature-review container. Delegates all orchestration (box
 * loading, chunked parallel review pipeline, finalize flow) to the
 * {@link useLiteratureReview} hook and only renders the grid of sub-boxes and
 * the action buttons.
 */
export function LiteratureReviewContent() {
  const {
    subBoxes,
    loading,
    processing,
    confirming,
    boxStatuses,
    boxErrors,
    allProcessed,
    archivalBoxes,
    literaturePool,
    addArchiveEntry,
    startReviewProcess,
    handleFinalize,
  } = useLiteratureReview();

  const boxTypeLabels: Record<string, string> = {
    CONCEPTUAL: "Teorik Çatı",
    PROBLEMATIZATION: "Problematizasyon",
    PRIMARY_MATERIAL: "Birincil Malzeme",
    DATA_PROTOCOL: "Metodoloji",
    RELATED_THESES: "İlişkisel Tezler",
  };

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
            : literaturePool.some((e) => e.subBoxTitle === subBox.title);
          return (
            <Card key={subBox.title} className="p-6 space-y-4 rounded-md">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-primary/20" />
                <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
                  {subBox.title}
                </h3>
                {subBox.boxType && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary ml-auto">
                    {boxTypeLabels[subBox.boxType] ?? subBox.boxType}
                  </span>
                )}
              </div>
              {subBox.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {subBox.description}
                </p>
              )}
              {isCompleted ||
              (isArchival && boxStatuses[subBox.title] === "done") ? (
                <SubBoxDone
                  subBox={subBox}
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
        {processing ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Alt kutular taranıyor...
            </p>
          </div>
        ) : !allProcessed ? (
          <div className="flex flex-col items-end gap-3">
            {literaturePool.length === 0 && (
              <Button onClick={startReviewProcess} size="lg">
                Literatür Taramasını Başlat
              </Button>
            )}
            {literaturePool.length > 0 && (
              <>
                <p className="text-sm text-warning font-medium">
                  Lütfen protokol/saha kutuları için gerekli girişleri
                  tamamlayın.
                </p>
                <Button disabled size="lg">
                  Onayla ve Teze Başla.
                </Button>
              </>
            )}
          </div>
        ) : (
          <Button onClick={handleFinalize} disabled={confirming} size="lg">
            {confirming ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </span>
            ) : (
              "Onayla ve Teze Başla"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
