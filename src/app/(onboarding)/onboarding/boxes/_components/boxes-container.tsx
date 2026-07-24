"use client";

import { useCallback, useMemo, memo, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Box,
  Library,
  FileText,
  PlusCircle,
  WholeWord,
  Archive,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLoadingOverlay } from "@/providers/loading-overlay-provider";
import { Card, CardTitle } from "@/components/ui/card";
import { AIBanner } from "@/components/ai-banner";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useOnboardingNavigation } from "../../_hooks/use-onboarding-navigation";
import { fetchBoxesWithFullShape } from "../../_services/fetch-actions";
import { generateBoxesStructureAction, confirmBoxesAction } from "../actions";
import { BOX_ORDER_WEIGHT, BOX_TYPE_LABELS } from "../../_lib/box-constants";
import type { GeminiThesisBox } from "@/lib/types";

/**
 * Determines whether a box card should span the full grid width.
 * Cards beyond index 4 take the full width (third row in a 2-col grid
 * where items 5+ render as stacked full-width cards).
 */
function isFullWidthBox(idx: number, totalBoxes: number): boolean {
  return (totalBoxes % 2 !== 0 && idx === totalBoxes - 1) || idx >= 4;
}

export function BoxesContainer() {
  const { proceedFromBoxes } = useOnboardingNavigation();
  const queryClient = useQueryClient();

  const {
    data: boxes,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ["boxes"],
    queryFn: async (): Promise<GeminiThesisBox[]> => {
      const existing = await fetchBoxesWithFullShape();
      if (existing.length > 0) return existing;
      return [];
    },
    staleTime: 0,
  });

  const [proceeding, setProceeding] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleProceed = useCallback(async () => {
    if (proceeding) return;
    setProceeding(true);
    try {
      await proceedFromBoxes();
    } finally {
      setProceeding(false);
    }
  }, [proceedFromBoxes, proceeding]);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const structResult = await generateBoxesStructureAction();
      if ("error" in structResult) {
        return;
      }
      const saveResult = await confirmBoxesAction(structResult.boxes);
      if ("error" in saveResult) {
        return;
      }
      queryClient.setQueryData(["boxes"], structResult.boxes);
      await refetch();
    } finally {
      setRetrying(false);
    }
  }, [retrying, queryClient, refetch]);

  const { hideLoading } = useLoadingOverlay();

  useEffect(() => {
    if (!loading && boxes && boxes.length > 0) {
      hideLoading();
    }
  }, [loading, boxes, hideLoading]);

  const sortedBoxes = useMemo(() => {
    if (!boxes) return [];
    return [...boxes]
      .filter((b) => b.parentId === null)
      .sort((a, b) => {
        return (
          (BOX_ORDER_WEIGHT[a.boxType] || 99) -
          (BOX_ORDER_WEIGHT[b.boxType] || 99)
        );
      });
  }, [boxes]);

  if (loading) {
    return <LoadingSpinner variant="full" message="Kutular yükleniyor..." />;
  }

  if (!boxes || boxes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            Kutular Oluşturulamadı
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Konu kutuları oluşturulurken bir hata oluştu. Lütfen tekrar deneyin
            veya tekrar deneyin.
          </p>
        </div>
        <Button onClick={handleRetry} disabled={retrying} size="lg">
          {retrying ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Yeniden oluşturuluyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Yeniden Dene
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <AIBanner
        icon={CheckCircle2}
        title="Konu Kutuları Yapılandırıldı"
        description="Tez matrisinizin çözümlenmesi başarıyla tamamlandı. Aşağıdaki her bir konu kutusu, literatür taraması sürecinde bağımsız olarak taranacaktır."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
        {sortedBoxes.map((box, idx) => (
          <BoxCard
            key={box.title}
            box={box}
            index={idx}
            isFullWidth={isFullWidthBox(idx, sortedBoxes.length)}
          />
        ))}
      </div>

      <div className="flex justify-end mt-8 pb-8">
        <Button onClick={handleProceed} disabled={proceeding} size="lg">
          <span className="flex items-center gap-2">
            {proceeding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Hazırlanıyor...
              </>
            ) : (
              <>
                <Box className="w-4 h-4" />
                Literatür Taramasına Geç
              </>
            )}
          </span>
        </Button>
      </div>
    </div>
  );
}

/**
 * Renders a single foundational-source query card inside a sub-box.
 */
const FoundationalQueryCard = memo(function FoundationalQueryCard({
  query,
}: {
  query: { title: string; author: string; publicationYear: number };
}) {
  const isDummy =
    query.publicationYear === 0 || query.author === "Primary Source Repository";
  const displayAuthor = isDummy ? "Birincil Kaynak Havuzu" : query.author;
  const displayTitle = isDummy
    ? "Saha Çalışması Belgeleri ve Ampirik Veri Kaynakları"
    : query.title;
  const displayYear = isDummy ? "" : ` (${query.publicationYear})`;

  return (
    <div className="p-2.5 rounded bg-background/60 border border-border/60 text-xs text-muted-foreground leading-relaxed space-y-1">
      <div className="text-foreground font-semibold font-serif line-clamp-2 break-words hyphens-auto">
        {displayTitle}
      </div>
      <div className="text-[10px] text-muted-foreground truncate">
        {displayAuthor}
        {displayYear && ` · ${displayYear}`}
      </div>
    </div>
  );
});

/**
 * Renders the sub-box nested section (timeline + cards).
 */
const SubBoxSection = memo(function SubBoxSection({
  subBoxes,
}: {
  subBoxes: GeminiThesisBox[];
}) {
  return (
    <div className="pt-4 space-y-4 mt-5">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Library className="w-3.5 h-3.5 text-primary" />
        Alt Konu Kutuları
      </h4>
      <div className="relative border-l border-primary/20 pl-4 ml-2.5 space-y-4 mt-2">
        {subBoxes.map((subBox, sbIdx) => (
          <div key={`${subBox.title}-${sbIdx}`} className="relative">
            <span className="absolute -left-[21.5px] top-[21px] h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
            <div className="p-4 rounded-md border border-border bg-card/40 hover:bg-card/75 hover:border-primary/20 transition-all duration-200 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h5 className="font-serif text-sm font-semibold text-foreground leading-snug line-clamp-2 break-words hyphens-auto">
                  {subBox.title}
                </h5>
              </div>
              {subBox.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
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
                      <FoundationalQueryCard
                        key={`${fq.title}-${fqIdx}`}
                        query={fq}
                      />
                    ))}
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Renders the PRIMARY_MATERIAL box info section.
 */
const PrimaryMaterialSection = memo(function PrimaryMaterialSection() {
  return (
    <div className="pt-4 space-y-2 mt-5">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Archive className="w-3.5 h-3.5 text-muted-foreground" />
        Arşiv / Birincil Malzeme Alanı
      </h4>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Bu kutu, saha çalışması verileri ve birincil kaynaklar için ayrılmıştır.
        Kurucu literatür taraması yapılmamıştır; arşiv belgeleri bir sonraki
        adımda el ile girilecektir.
      </p>
    </div>
  );
});

/**
 * Renders the RELATED_THESES box info section.
 */
const RelatedThesesSection = memo(function RelatedThesesSection() {
  return (
    <div className="pt-4 space-y-3 mt-5">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Archive className="w-3.5 h-3.5 text-muted-foreground" />
        Sınırdaş Tez Havuzu
      </h4>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Bu kutu, özgünlük analizinde tespit edilen sınırdaş tez çalışmalarını
        barındırır.
      </p>
    </div>
  );
});

const BoxCard = memo(function BoxCard({
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
            {BOX_TYPE_LABELS[box.boxType]}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
          <CardTitle className="text-lg font-semibold text-foreground leading-snug line-clamp-2 break-words hyphens-auto">
            {box.title}
          </CardTitle>
        </div>
      </div>

      {box.description && (
        <p className="text-sm text-muted-foreground leading-relaxed mt-4 line-clamp-3">
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
                  <WholeWord className="w-3.5 h-3.5 shrink-0" />
                  {concept}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {box.subBoxes && box.subBoxes.length > 0 ? (
        <SubBoxSection subBoxes={box.subBoxes} />
      ) : box.boxType === "PRIMARY_MATERIAL" ? (
        <PrimaryMaterialSection />
      ) : box.boxType === "RELATED_THESES" ? (
        <RelatedThesesSection />
      ) : null}
    </Card>
  );
});
