"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  CheckCircle2,
  Box,
  Library,
  FileText,
  PlusCircle,
  WholeWord,
  Archive,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { AIBanner } from "@/components/ai-banner";
import { LoadingSpinner } from "@/components/loading-spinner";
import { fetchBoxesWithFullShape } from "../../_lib/fetch-actions";
import type { GeminiThesisBox, RelatedThesisEntry } from "@/lib/types";

const boxTypeOrder: Record<string, number> = {
  PROBLEMATIZATION: 1,
  CONCEPTUAL: 2,
  DATA_PROTOCOL: 3,
  PRIMARY_MATERIAL: 4,
  CONTEXT: 5,
  RELATED_THESES: 6,
};

const badgeLabels: Record<string, string> = {
  CONCEPTUAL: "Teorik Çatı",
  PROBLEMATIZATION: "Problematizasyon",
  PRIMARY_MATERIAL: "Birincil Malzeme",
  CONTEXT: "Bağlam",
  DATA_PROTOCOL: "Metodoloji",
  RELATED_THESES: "İlişkisel Tezler",
};

export function BoxesContainer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const { data: boxes, isLoading: loading } = useQuery({
    queryKey: ["boxes"],
    queryFn: async (): Promise<GeminiThesisBox[]> => {
      const existing = await fetchBoxesWithFullShape();
      if (existing.length > 0) return existing;
      return [];
    },
    staleTime: 0,
  });

  const handleProceed = useCallback(() => {
    startTransition(() => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
      router.push("/onboarding/literature-review");
    });
  }, [queryClient, router]);

  if (loading) {
    return <LoadingSpinner variant="full" message="Kutular yükleniyor..." />;
  }

  if (!boxes) {
    return <LoadingSpinner variant="full" />;
  }

  const sortedBoxes = [...boxes]
    .filter((b) => b.parentId === null)
    .sort((a, b) => {
      return (boxTypeOrder[a.boxType] || 99) - (boxTypeOrder[b.boxType] || 99);
    });
  return (
    <div className="w-full space-y-8">
      <AIBanner
        icon={CheckCircle2}
        title="Konu Kutuları Yapılandırıldı"
        description="Tez matrisinizin çözümlenmesi başarıyla tamamlandı. Aşağıdaki her bir konu kutusu, literatür taraması sürecinde bağımsız olarak taranacaktır."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-min">
        {sortedBoxes.map((box, idx) => {
          const isFullWidth =
            (sortedBoxes.length % 2 !== 0 && idx === sortedBoxes.length - 1) ||
            idx >= 4;
          return (
            <BoxCard
              key={box.title}
              box={box}
              index={idx}
              isFullWidth={isFullWidth}
            />
          );
        })}
      </div>

      <div className="flex justify-end mt-8 pb-8">
        <Button onClick={handleProceed} disabled={isPending} size="lg">
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Box className="w-4 h-4" />
              Konu Kutularını Onayla ve Literatür Taramasına Geç
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Bir örtüşen tez kaydını kart olarak görüntüler.
 */
function RelatedThesisCard({ thesis }: { thesis: RelatedThesisEntry }) {
  return (
    <div className="border border-border/60 rounded-md p-3 space-y-2 bg-card/30">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {thesis.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {thesis.author} — {thesis.university} ({thesis.year})
        </p>
      </div>

      {thesis.thesisType && (
        <p className="text-[11px] text-muted-foreground">
          {thesis.thesisType} · {thesis.department}
        </p>
      )}

      {thesis.yokPdfUrl && (
        <a
          href={thesis.yokPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          YÖK Tez PDF
        </a>
      )}
    </div>
  );
}

function BoxCard({
  box,
  index,
  isFullWidth = false,
}: {
  box: GeminiThesisBox;
  index: number;
  isFullWidth?: boolean;
}) {
  const parentConcepts = box.concepts ?? [];

  return (
    <Card
      className={`group/card flex flex-col h-full p-6 rounded-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/20${isFullWidth ? " md:col-span-2" : ""}`}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <PlusCircle className="w-3 h-3" />
          <span>Kutu {index + 1}</span>
          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border/40">
            {badgeLabels[box.boxType]}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
          <CardTitle className="text-lg font-semibold text-foreground leading-snug">
            {box.title}
          </CardTitle>
        </div>
      </div>

      {box.description && (
        <p className="text-sm text-muted-foreground leading-relaxed mt-4">
          {box.description}
        </p>
      )}

      {parentConcepts.length > 0 && (
        <div className="mt-4">
          <div className="border-y border-border py-3">
            <div className="flex flex-wrap gap-2">
              {parentConcepts.map((concept, i) => (
                <span
                  key={`${concept}-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-xs text-primary font-semibold"
                >
                  <WholeWord className="w-3.5 h-3.5" />
                  {concept}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {box.subBoxes && box.subBoxes.length > 0 ? (
        <div className="border-t border-border/40 pt-4 space-y-4 mt-5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Library className="w-3.5 h-3.5 text-primary" />
            Alt Konu Kutuları
          </h4>
          <div className="relative border-l border-primary/20 pl-4 ml-2.5 space-y-4 mt-2">
            {box.subBoxes.map((subBox, sbIdx) => (
              <div key={`${subBox.title}-${sbIdx}`} className="relative">
                {/* Timeline Node */}
                <span className="absolute -left-[21.5px] top-[21px] h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />

                {/* Nested Box Card */}
                <div className="p-4 rounded-md border border-border bg-card/40 hover:bg-card/75 hover:border-primary/20 transition-all duration-200 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="font-serif text-sm font-semibold text-foreground leading-snug">
                      {subBox.title}
                    </h5>
                  </div>
                  {subBox.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {subBox.description}
                    </p>
                  )}
                  {subBox.concepts && subBox.concepts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {subBox.concepts.map((concept, cIdx) => (
                        <span
                          key={`${concept}-${cIdx}`}
                          className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary font-medium"
                        >
                          {concept}
                        </span>
                      ))}
                    </div>
                  )}
                  {subBox.foundationalQueries &&
                    subBox.foundationalQueries.length > 0 && (
                      <div className="pt-3 mt-3 border-t border-border/40 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          <span>Temel Akademik Kaynak</span>
                        </div>
                        {subBox.foundationalQueries.map((fq, fqIdx) => (
                          <div
                            key={`${fq.title}-${fqIdx}`}
                            className="p-2.5 rounded bg-background/60 border border-border/60 text-xs text-muted-foreground leading-relaxed space-y-1"
                          >
                            {(() => {
                              const isDummy =
                                fq.publicationYear === 0 ||
                                fq.author === "Primary Source Repository";
                              const displayAuthor = isDummy
                                ? "Birincil Kaynak Havuzu"
                                : fq.author;
                              const displayTitle = isDummy
                                ? "Saha Çalışması Belgeleri ve Ampirik Veri Kaynakları"
                                : fq.title;
                              const displayYear = isDummy
                                ? ""
                                : ` (${fq.publicationYear})`;
                              return (
                                <>
                                  <div className="text-foreground font-semibold font-serif">
                                    {displayTitle}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {displayAuthor}{" "}
                                    {displayYear && `· ${displayYear}`}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : box.boxType === "PRIMARY_MATERIAL" ? (
        <div className="border-t border-border/40 pt-4 space-y-2 mt-5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Archive className="w-3.5 h-3.5 text-muted-foreground" />
            {box.boxType === "PRIMARY_MATERIAL"
              ? "Arşiv / Birincil Malzeme Alanı"
              : "Bağlamsal Sınırlar"}
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {box.boxType === "PRIMARY_MATERIAL"
              ? "Bu kutu, saha çalışması verileri ve birincil kaynaklar için ayrılmıştır. Kurucu literatür taraması yapılmamıştır; arşiv belgeleri bir sonraki adımda el ile girilecektir."
              : "Bu kutu, yerel ve küresel bağlamsal arka plan faktörleri için ayrılmıştır. Kurucu literatür taraması yapılmamıştır; bağlamsal bilgiler bir sonraki adımda el ile girilecektir."}
          </p>
        </div>
      ) : box.boxType === "RELATED_THESES" ? (
        <div className="border-t border-border/40 pt-4 space-y-3 mt-5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Archive className="w-3.5 h-3.5 text-muted-foreground" />
            Sınırdaş Tez Havuzu
            {box.relatedTheses && box.relatedTheses.length > 0 && (
              <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary">
                {box.relatedTheses.length} tez
              </span>
            )}
          </h4>
          {box.relatedTheses && box.relatedTheses.length > 0 ? (
            <div className="flex flex-col gap-4">
              {box.relatedTheses.map((thesis, i) => (
                <RelatedThesisCard key={`${thesis.title}-${i}`} thesis={thesis} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bu kutu, özgünlük analizinde tespit edilen sınırdaş tez
              çalışmalarını barındırır.
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
