"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Rocket,
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
  RELATED_THESES: 5,
};

const badgeLabels: Record<string, string> = {
  CONCEPTUAL: "Teorik Çatı",
  PROBLEMATIZATION: "Problematizasyon",
  PRIMARY_MATERIAL: "Birincil Malzeme",
  DATA_PROTOCOL: "Metodoloji",
  RELATED_THESES: "\u0130lişkisel Tezler",
};

export function BoxesContainer() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: boxes, isLoading: loading } = useQuery({
    queryKey: ["boxes"],
    queryFn: async (): Promise<GeminiThesisBox[]> => {
      const existing = await fetchBoxesWithFullShape();
      if (existing.length > 0) return existing;
      return [];
    },
    staleTime: Infinity,
  });

  const handleProceed = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
    router.push("/onboarding/literature-review");
  }, [queryClient, router]);

  if (loading) {
    return <LoadingSpinner variant="full" message="Kutular yükleniyor..." />;
  }

  if (!boxes) {
    return <LoadingSpinner variant="full" />;
  }

  const sortedBoxes = [...boxes].sort((a, b) => {
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
          const isLastOdd =
            sortedBoxes.length % 2 !== 0 && idx === sortedBoxes.length - 1;
          return (
            <BoxCard
              key={box.title}
              box={box}
              index={idx}
              isLastOdd={isLastOdd}
            />
          );
        })}
      </div>

      <div className="flex justify-end mt-8 pb-8">
        <Button onClick={handleProceed} size="lg">
          <span className="flex items-center gap-2">
            <Rocket className="w-4 h-4" />
            Literatür Taramasına Geç
          </span>
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
        <p className="text-xs font-semibold text-foreground leading-snug">
          {thesis.title}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {thesis.author} — {thesis.university} ({thesis.year})
        </p>
      </div>

      {thesis.thesisType && (
        <p className="text-[10px] text-muted-foreground">
          {thesis.thesisType} · {thesis.department}
        </p>
      )}

      {thesis.yokPdfUrl && (
        <a
          href={thesis.yokPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-primary font-medium hover:underline"
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
  isLastOdd = false,
}: {
  box: GeminiThesisBox;
  index: number;
  isLastOdd?: boolean;
}) {
  const parentConcepts = box.concepts ?? [];
  const subFoundational = (box.subBoxes ?? []).flatMap(
    (sb) => sb.foundationalQueries ?? [],
  );

  return (
    <Card
      className={`group/card grid grid-rows-subgrid row-span-4 p-6 rounded-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/20${isLastOdd ? " md:col-span-2" : ""}`}
    >
      <div className="row-1 space-y-4">
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
        <p className="row-2 text-sm text-muted-foreground leading-relaxed">
          {box.description}
        </p>
      )}

      {parentConcepts.length > 0 && (
        <div className="row-3">
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

      {subFoundational.length > 0 ? (
        <div className="row-4 border-t border-border/40 pt-4 space-y-4">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Library className="w-3.5 h-3.5 text-primary" />
            Kurucu Literatür Temeli
          </h4>
          <ul className="space-y-2 pl-0.5">
            {subFoundational.slice(0, 3).map((fq, i) => (
              <li
                key={`${fq.title}-${fq.author}-${i}`}
                className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <FileText className="w-3.5 h-3.5 text-accent-foreground mt-0.5 shrink-0" />
                <span>
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
                        <strong className="font-medium text-foreground">
                          {displayAuthor}
                        </strong>{" "}
                        {displayYear && (
                          <span className="text-muted-foreground text-[10px]">
                            {displayYear}
                          </span>
                        )}{" "}
                        —{" "}
                        <span className="italic text-foreground">
                          {displayTitle}
                        </span>
                      </>
                    );
                  })()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : box.boxType === "PRIMARY_MATERIAL" ? (
        <div className="row-4 border-t border-border/40 pt-4 space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Archive className="w-3.5 h-3.5 text-muted-foreground" />
            Arşiv / Birincil Malzeme Alanı
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Bu kutu, saha çalışması verileri ve birincil kaynaklar için
            ayrılmıştır. Kurucu literatür taraması yapılmamıştır; arşiv
            belgeleri bir sonraki adımda el ile girilecektir.
          </p>
        </div>
      ) : box.boxType === "RELATED_THESES" ? (
        <div className="row-4 border-t border-border/40 pt-4 space-y-3">
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
            <div className="space-y-3">
              {box.relatedTheses.map((thesis, i) => (
                <RelatedThesisCard
                  key={`${thesis.title}-${i}`}
                  thesis={thesis}
                />
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
