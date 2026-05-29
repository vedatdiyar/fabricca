"use client";

import React, { useState } from "react";
import { Sparkles, Loader2, ExternalLink, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { LiteratureRecommendation } from "../actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RecommendationGridProps {
  recs: LiteratureRecommendation[];
  boxes: {
    id: number;
    name: string;
    description: string | null;
  }[];
  isLoadingRecs: boolean;
  recsError: string;
  onRefresh: (boxId?: number) => void;
  onSelectRec: (rec: LiteratureRecommendation) => void;
}

export function RecommendationGrid({
  recs,
  boxes,
  isLoadingRecs,
  recsError,
  onRefresh,
  onSelectRec,
}: RecommendationGridProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const groupedRecs = recs.reduce<
    Record<number, { boxName: string; items: LiteratureRecommendation[] }>
  >((acc, rec) => {
    const boxId = rec.boxId ?? 0;
    if (!acc[boxId]) {
      acc[boxId] = { boxName: rec.boxName || `Kutu ${boxId}`, items: [] };
    }
    acc[boxId].items.push(rec);
    return acc;
  }, {});
  const boxEntries = Object.entries(groupedRecs).sort(
    ([a], [b]) => Number(a) - Number(b),
  );

  return (
    <div className="w-full border border-border bg-card rounded-lg overflow-hidden transition-all duration-300 mb-8">
      {/* Panel Header */}
      <div className="p-5 border-b border-border flex justify-between items-center bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Literatür Önerileri</span>
            </h2>
            <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
              Tez Anayasanızdaki argüman ve araştırma sorusuna derinlik katacak yapay zeka tarafından önerilen temel akademik kaynaklar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger
              disabled={isLoadingRecs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/20 text-xs font-semibold text-primary hover:bg-primary/10 hover:border-primary/30 transition cursor-pointer disabled:opacity-50 bg-transparent font-sans"
            >
              <Sparkles className="size-3" />
              <span className="hidden sm:inline">{isLoadingRecs ? "Taranıyor..." : "Literatürü Tara"}</span>
              <span className="sm:hidden">{isLoadingRecs ? "Tarama..." : "Tara"}</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] bg-card border border-border text-foreground rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  <span>Akıllı Bölüm Bazlı Literatür Taraması</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-sans">
                  Tez Anayasanızın genel makro bağlamını koruyarak, seçtiğiniz bölüme özel mikro odaklı ve kademeli soyutlama filtreli literatür araması başlatın.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-sans">
                  Taramak İstediğiniz Bölümü Seçin:
                </p>
                
                <div className="grid grid-cols-1 gap-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {/* Tüm Tez Seçeneği */}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onRefresh();
                    }}
                    className="w-full text-left p-3.5 rounded-lg border border-border bg-background hover:border-primary transition group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="size-5 rounded-full border border-border group-hover:border-primary flex items-center justify-center shrink-0 mt-0.5">
                      <div className="size-2.5 rounded-full bg-transparent group-hover:bg-primary transition" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground font-sans group-hover:text-primary transition">
                        Tüm Tez Bölümleri (Toplu Tarama)
                      </h4>
                      <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                        Tezin tüm çalışma kutuları için sırayla küresel ve yerel indeks araması gerçekleştirir.
                      </p>
                    </div>
                  </button>

                  {/* Bölüm Bazlı Seçenekler */}
                  {boxes.map((box) => (
                    <button
                      key={box.id}
                      onClick={() => {
                        setIsOpen(false);
                        onRefresh(box.id);
                      }}
                      className="w-full text-left p-3.5 rounded-lg border border-border bg-background hover:border-primary transition group flex items-start gap-3 cursor-pointer"
                    >
                      <div className="size-5 rounded-full border border-border group-hover:border-primary flex items-center justify-center shrink-0 mt-0.5">
                        <div className="size-2.5 rounded-full bg-transparent group-hover:bg-primary transition" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-foreground font-sans group-hover:text-primary transition">
                          {box.name}
                        </h4>
                        {box.description && (
                          <p className="text-xs text-muted-foreground font-sans leading-relaxed line-clamp-2">
                            {box.description}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
            title={isCollapsed ? "Genişlet" : "Daralt"}
          >
            {isCollapsed ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* Panel Content (Collapsible) */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed ? "max-h-0 opacity-0" : "max-h-[3000px] opacity-100"
        }`}
      >
        <div className="p-6 space-y-6 bg-card">
          {isLoadingRecs ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="size-6 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground mt-3 font-sans">
                Tez anayasasına uygun akademik literatür taranıyor ve analiz
                ediliyor...
              </p>
            </div>
          ) : recsError === "API_CONNECTION_FAILURE" ? (
            <div className="border border-primary bg-background rounded-lg p-6 text-center space-y-3 max-w-2xl mx-auto">
              <h4 className="text-xs font-bold font-sans text-primary uppercase tracking-widest">
                Bağlantı Hatası
              </h4>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                Ulusal ve uluslararası makale servis sağlayıcılarına (OpenAlex /
                Semantic Scholar) şu an erişilemiyor. Lütfen kısa bir süre sonra
                tekrar deneyin.
              </p>
            </div>
          ) : recsError ===
            "Tavsiye üretilebilmesi için öncelikle Tez Anayasası'nı oluşturmalısınız." ? (
            <div className="border border-dashed border-border rounded-lg py-8 text-center text-xs text-muted-foreground font-sans">
              Tavsiye üretilebilmesi için öncelikle Tez Anayasası&apos;nı
              oluşturmalısınız.
            </div>
          ) : recsError ? (
            <div className="border border-destructive bg-background rounded-lg p-6 text-center space-y-3 max-w-2xl mx-auto">
              <h4 className="text-xs font-bold font-sans text-destructive uppercase tracking-widest">
                Sistem Hatası
              </h4>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                {recsError}
              </p>
            </div>
          ) : recs.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg py-8 text-center text-xs text-muted-foreground">
              Henüz literatür taraması yapılmadı. &ldquo;Literatürü Tara&rdquo;
              butonuna tıklayarak akademik kaynak önerilerini alabilirsiniz.
            </div>
          ) : (
            boxEntries.map(([boxId, { boxName, items }], groupIndex) => (
              <React.Fragment key={boxId}>
                {groupIndex > 0 && <hr className="my-8 border-border" />}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-foreground">{boxName}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {items.map((rec, i) => (
                      <div
                        key={rec.paperId || i}
                        className="bg-background border border-border p-6 rounded-lg flex flex-col justify-between space-y-5 hover:border-primary transition duration-150 h-full"
                      >
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-sans font-bold text-primary bg-secondary px-2 py-0.5 rounded border border-border shrink-0">
                                Öneri #{i + 1}
                              </span>
                              <span className="text-xs font-sans font-bold text-primary bg-secondary px-2 py-0.5 rounded border border-primary shrink-0">
                                {rec.source || "Semantic Scholar"}
                              </span>
                              <span className="text-xs font-sans font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border shrink-0">
                                {rec.lang || "EN"}
                              </span>
                            </div>
                            {typeof rec.citationCount === "number" &&
                              rec.citationCount > 0 && (
                                <span className="text-xs font-sans font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border shrink-0">
                                  Atıf: {rec.citationCount.toLocaleString()}
                                </span>
                              )}
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-foreground mt-2 leading-relaxed font-sans line-clamp-3">
                              {rec.title}
                            </h4>
                            <p className="text-xs text-muted-foreground font-sans">
                              {rec.authors} ({rec.year})
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed font-sans border-t border-border pt-2.5">
                            {rec.relevance}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 shrink-0">
                          {rec.url && (
                            <a
                              href={rec.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>Kaynağa Git</span>
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                          <button
                            onClick={() => onSelectRec(rec)}
                            className="text-xs font-bold text-muted-foreground hover:text-primary hover:underline flex items-center gap-1 cursor-pointer group"
                          >
                            <Upload className="size-3.5 transition group-hover:text-primary" />
                            <span>PDF Yükle</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </React.Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
