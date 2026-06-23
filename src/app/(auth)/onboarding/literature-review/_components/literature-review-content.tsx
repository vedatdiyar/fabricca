"use client";

import { useState } from "react";
import {
  Loader2,
  AlertCircle,
  BookOpen,
  Library,
  Archive,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="space-y-3 border border-dashed border-border rounded-lg bg-card/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Archive className="w-4 h-4 text-muted-foreground" />
        <span>Birincil Arşiv Belgesi Ekle</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
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
        className="min-h-[60px] text-sm"
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
        <div className="h-24 w-full rounded-lg bg-muted/20" />
        <div className="h-24 w-full rounded-lg bg-muted/20" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-6 text-center border border-destructive/20 rounded-lg bg-destructive/5">
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
  isArchival,
  onAddArchiveEntry,
}: {
  subBox: GeminiThesisBox;
  isArchival: boolean;
  onAddArchiveEntry: (
    subBoxTitle: string,
    entry: { title: string; description?: string },
  ) => void;
}) {
  const literaturePool = useOnboardingStore((s) => s.literaturePool);
  const entry = literaturePool.find((e) => e.subBoxTitle === subBox.title);

  if (isArchival) {
    return (
      <div className="space-y-4">
        <ArchiveEntryForm
          onAddEntry={(title, desc) =>
            onAddArchiveEntry(subBox.title, { title, description: desc })
          }
        />
        {entry && entry.starterPack.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-success/10 border border-success/20">
              <Archive className="w-4 h-4 text-success shrink-0" />
              <p className="text-xs text-success font-medium">
                <span className="font-semibold">
                  {entry.starterPack.length}
                </span>{" "}
                birincil arşiv belgesi eklendi.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {entry.starterPack.map((article, idx) => (
                <LiteratureArticleCard key={idx} article={article} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (!entry || entry.starterPack.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed border-border rounded-lg bg-card/20">
        <p className="text-sm text-muted-foreground">Kaynak bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {entry.starterPack.map((article, idx) => (
          <LiteratureArticleCard key={idx} article={article} />
        ))}
      </div>
      {entry.reservedPool.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/20 border border-border/20">
          <Library className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {entry.reservedPool.length}
            </span>{" "}
            ek kaynak daha önerildi.
          </p>
        </div>
      )}
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
    handleFinalize,
  } = useLiteratureReview();

  const boxTypeLabels: Record<string, string> = {
    PROBLEMATIZATION: "Soru Odaklı",
    CONCEPTUAL: "Teorik Altyapı",
    DATA_PROTOCOL: "Yöntem / Protokol",
    ANALYSIS_FINDINGS: "Saha ve Bulgular",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="p-4 bg-muted/20 rounded-full inline-flex mx-auto">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
          <p className="text-muted-foreground text-sm">
            Konu kutuları yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-24">
      <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-full">
          <BookOpen className="w-12 h-12 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-medium tracking-tight text-foreground">
            Literatür Taraması
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Her bir kutu için akademik veri tabanları taranıyor.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {subBoxes.map((subBox, idx) => {
          const isArchival = archivalBoxes.has(subBox.title);
          const isCompleted = archivalBoxes.has(subBox.title)
            ? false
            : literaturePool.some((e) => e.subBoxTitle === subBox.title);
          return (
            <div
              key={idx}
              className="border border-border rounded-xl bg-card p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-primary/20" />
                <h3 className="text-xl font-medium text-foreground tracking-tight">
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
                  isArchival={isArchival}
                  onAddArchiveEntry={addArchiveEntry}
                />
              ) : (
                <SubBoxQuery
                  status={boxStatuses[subBox.title] ?? "idle"}
                  errorMessage={boxErrors[subBox.title]}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center pt-4">
        {processing ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Alt kutular taranıyor...
            </p>
          </div>
        ) : !allProcessed ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-amber-600 font-medium">
              Lütfen protokol/saha kutuları için gerekli girişleri tamamlayın.
            </p>
            <Button
              disabled
              className="btn-academic-hero w-full sm:w-auto opacity-60"
            >
              Onayla ve Teze Başla.
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleFinalize}
            disabled={confirming}
            className="btn-academic-hero w-full sm:w-auto"
          >
            {confirming ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </span>
            ) : (
              "Onayla ve Teze Başla."
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
