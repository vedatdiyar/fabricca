"use client";

import React from "react";
import { Sparkles, Loader2, ExternalLink, Upload } from "lucide-react";
import { LiteratureRecommendation } from "../actions";

interface RecommendationGridProps {
  recs: LiteratureRecommendation[];
  isLoadingRecs: boolean;
  recsError: string;
  onRefresh: () => void;
  onSelectRec: (rec: LiteratureRecommendation) => void;
}

export function RecommendationGrid({
  recs,
  isLoadingRecs,
  recsError,
  onRefresh,
  onSelectRec,
}: RecommendationGridProps) {
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
    <div className="w-full border border-border bg-card p-6 rounded-lg shadow-xl space-y-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span>Literatür Önerileri</span>
          </h2>
          <p className="text-xs text-muted-foreground font-sans mt-0.5">
            Tez Anayasanızdaki argüman ve araştırma sorusuna derinlik katacak
            yapay zeka tarafından önerilen temel akademik kaynaklar
          </p>
        </div>
        <button
          disabled={isLoadingRecs}
          onClick={onRefresh}
          className="text-xs font-semibold border border-primary text-primary bg-background hover:bg-primary hover:text-primary-foreground transition duration-150 rounded px-3.5 py-2 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50 shrink-0 whitespace-nowrap"
        >
          <Sparkles className="size-3.5" />
          <span>{isLoadingRecs ? "Taranıyor..." : "Literatürü Tara"}</span>
        </button>
      </div>

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
  );
}
