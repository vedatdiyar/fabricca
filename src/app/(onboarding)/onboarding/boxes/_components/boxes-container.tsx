"use client";

import { useCallback, useMemo, memo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ArrowRight,
  Library,
  PlusCircle,
  WholeWord,
  Archive,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { AIBanner } from "@/components/shared/ai-banner";
import { BoxesSkeleton } from "./boxes-skeleton";
import { useBoxesContinue } from "../../_hooks/use-boxes-continue";
import { fetchBoxesWithFullShape } from "../../_services/fetch-actions";
import { BOX_ORDER_WEIGHT, BOX_TYPE_LABELS } from "@/lib/box-constants";
import type { GeminiThesisBox } from "@/lib/types";

/**
 * Determines whether a box card should span the full grid width, with cards beyond
 * index 4 taking the full width (third row in a 2-col grid where items 5+ render
 * as stacked full-width cards).
 *
 * @param idx - The index of the box within the grid.
 * @param totalBoxes - The total number of top-level boxes.
 * @returns True when the box card should span the full grid width.
 */
function isFullWidthBox(idx: number, totalBoxes: number): boolean {
  return (totalBoxes % 2 !== 0 && idx === totalBoxes - 1) || idx >= 4;
}

/**
 * Renders the subject boxes overview with a proceed-to-literature action.
 *
 * @returns The boxes container markup.
 */
export function BoxesContainer() {
  const { proceedFromBoxes } = useBoxesContinue();

  const { data: boxes, isLoading: loading } = useQuery({
    queryKey: ["boxes"],
    queryFn: fetchBoxesWithFullShape,
    staleTime: 0,
  });

  const [proceeding, setProceeding] = useState(false);

  const handleProceed = useCallback(async () => {
    if (proceeding) return;
    setProceeding(true);
    try {
      await proceedFromBoxes();
    } finally {
      setProceeding(false);
    }
  }, [proceedFromBoxes, proceeding]);

  const sortedBoxes = useMemo(() => {
    if (!boxes) return [];
    return [...boxes]
      .filter((b) => b.parentId === null && b.boxType !== "RELATED_THESES")
      .sort((a, b) => {
        return (
          (BOX_ORDER_WEIGHT[a.boxType] || 99) -
          (BOX_ORDER_WEIGHT[b.boxType] || 99)
        );
      });
  }, [boxes]);

  if (loading) {
    return <BoxesSkeleton />;
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
          {proceeding ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Onayla ve Tez Planı Adımına Geç
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Renders the sub-box nested section (timeline + cards).
 *
 * @param root0 - The section props object.
 * @param root0.subBoxes - The sub-boxes to render.
 * @returns The sub-box section markup.
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
      <div className="relative border-l border-primary/20 pl-4 ml-3 space-y-4 mt-2">
        {subBoxes.map((subBox, sbIdx) => (
          <div key={`${subBox.title}-${sbIdx}`} className="relative">
            <span className="absolute -left-[21.5px] top-[21px] h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
            <div className="p-4 rounded-md border border-border bg-card hover:border-primary/20 transition-all duration-200 space-y-2">
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
                <div className="flex flex-wrap gap-2 pt-1">
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Renders the PRIMARY_MATERIAL box info section.
 *
 * @returns The primary material info section markup.
 */
const PrimaryMaterialSection = memo(function PrimaryMaterialSection() {
  return (
    <div className="pt-4 space-y-2 mt-5">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Archive className="w-3.5 h-3.5 text-muted-foreground" />
        Arşiv / Birincil Kaynak Alanı
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
 * Renders a single box card with its sub-boxes and metadata.
 *
 * @param root0 - The card props object.
 * @param root0.box - The thesis box to render.
 * @param root0.index - The index of the box within the grid.
 * @param root0.isFullWidth - Whether the card spans the full grid width.
 * @returns The box card markup.
 */
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
          <span className="ml-auto inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border/40">
            {BOX_TYPE_LABELS[box.boxType]}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="relative mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
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
      ) : null}
    </Card>
  );
});
