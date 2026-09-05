"use client";

import { useCallback, useMemo, memo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Target,
  Compass,
  Microscope,
  BookOpen,
  Library,
  Archive,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AIBanner } from "@/components/shared/ai-banner";
import { OnboardingStepFooter } from "@/app/(onboarding)/onboarding/_components/onboarding-step-footer";
import { BoxesSkeleton } from "./boxes-skeleton";
import { useBoxesContinue } from "../../_hooks/use-boxes-continue";
import { fetchBoxesWithFullShape } from "@/app/(onboarding)/onboarding/_services/fetch-actions";
import { BOX_TYPE_LABELS, sortByBoxType } from "@/lib/box-constants";
import type { ThesisBoxType } from "@/lib/box-constants";
import type { GeminiThesisBox } from "@/lib/types";

const BOX_TYPE_ICONS: Record<
  ThesisBoxType,
  React.ComponentType<{ className?: string }>
> = {
  SUBJECT_PROBLEM: Target,
  THEORETICAL_FRAMEWORK: Compass,
  METHODOLOGY: Microscope,
  PRIMARY_MATERIAL: BookOpen,
  RELATED_THESES: Library,
};

/**
 * Renders the subject boxes overview with a proceed-to-literature action.
 *
 * @returns The boxes container markup.
 */
export function BoxesContainer() {
  const router = useRouter();
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
      .sort(sortByBoxType);
  }, [boxes]);

  if (loading) {
    return <BoxesSkeleton />;
  }

  return (
    <div className="w-full space-y-6">
      <AIBanner
        icon={CheckCircle2}
        title="Konu Kutuları Yapılandırıldı"
        description="Tez matrisinizin çözümlenmesi başarıyla tamamlandı. Aşağıdaki her bir konu kutusu, literatür taraması sürecinde bağımsız olarak taranacaktır."
      />

      <div className="grid grid-cols-1 gap-4 auto-rows-min">
        {sortedBoxes.map((box, idx) => (
          <BoxCard key={box.title} box={box} index={idx} />
        ))}
      </div>

      <OnboardingStepFooter
        onBack={() => router.push("/onboarding/outline")}
        backLabel="Tez Planına Dön"
        backDisabled={proceeding}
        onNext={handleProceed}
        nextLabel="Literatür Taramasına Geç"
        nextDisabled={proceeding}
        nextLoading={proceeding}
        nextLoadingText="Kaydediliyor..."
      />
    </div>
  );
}

/**
 * Renders the sub-box nested section with each focus area presented as a dedicated card.
 *
 * @param root0 - The section props object.
 * @param root0.subBoxes - The sub-boxes to render.
 * @param root0.parentIndex - The 1-based index of the parent box.
 * @returns The sub-box section markup.
 */
const SubBoxSection = memo(function SubBoxSection({
  subBoxes,
  parentIndex,
}: {
  subBoxes: GeminiThesisBox[];
  parentIndex: number;
}) {
  return (
    <div className="pt-3 border-t border-border/40 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Alt Odak Alanları ({subBoxes.length})
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {subBoxes.map((subBox, sbIdx) => (
          <Card
            key={`${subBox.title}-${sbIdx}`}
            className="flex flex-col justify-between p-4 rounded-md border border-border/60 bg-card/60 transition-colors hover:border-primary/30 space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary shrink-0">
                    {parentIndex}.{sbIdx + 1}
                  </span>
                  <h4 className="font-serif text-sm font-semibold text-foreground tracking-tight leading-snug">
                    {subBox.title}
                  </h4>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs font-medium text-muted-foreground shrink-0 border-border/40"
                >
                  Alt Odak
                </Badge>
              </div>
              {subBox.description && (
                <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                  {subBox.description}
                </p>
              )}
            </div>

            {subBox.concepts && subBox.concepts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {subBox.concepts.map((concept, cIdx) => (
                  <Badge
                    key={`${concept}-${cIdx}`}
                    variant="secondary"
                    className="px-2 py-0.5 text-xs font-medium rounded-md"
                  >
                    {concept}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
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
    <div className="pt-3 border-t border-border/40 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Archive className="size-3.5 text-muted-foreground" />
        <span className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Arşiv / Birincil Kaynak Alanı
        </span>
      </div>
      <p className="font-sans text-xs text-muted-foreground leading-relaxed">
        Bu kutu saha çalışması ve birincil kaynaklar için ayrılmıştır. Arşiv
        belgeleri literatür taramasından sonra doğrudan eklenecektir.
      </p>
    </div>
  );
});

/**
 * Renders a single box card with its sub-boxes and metadata in a minimalist style.
 *
 * @param root0 - The card props object.
 * @param root0.box - The thesis box to render.
 * @param root0.index - The index of the box within the list.
 * @returns The box card markup.
 */
const BoxCard = memo(function BoxCard({
  box,
  index,
}: {
  box: GeminiThesisBox;
  index: number;
}) {
  const Icon = BOX_TYPE_ICONS[box.boxType as ThesisBoxType] ?? Target;
  const parentConcepts = box.concepts ?? [];

  return (
    <Card className="flex flex-col p-5 sm:p-6 rounded-lg border border-border bg-card transition-colors hover:border-primary/20 space-y-4">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center size-5 rounded bg-primary/10 border border-primary/20 text-primary shrink-0">
            <Icon className="size-3.5" />
          </span>
          <span className="font-mono text-xs font-medium text-muted-foreground">
            Kutu 0{index + 1}
          </span>
        </div>
        <Badge
          variant="secondary"
          className="px-2.5 py-0.5 text-xs font-medium rounded-md"
        >
          {BOX_TYPE_LABELS[box.boxType as ThesisBoxType] ?? box.boxType}
        </Badge>
      </div>

      {/* Main Title & Description */}
      <div className="space-y-1.5">
        <h3 className="font-serif text-base font-semibold text-foreground tracking-tight leading-snug">
          {box.title}
        </h3>
        {box.description && (
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            {box.description}
          </p>
        )}
      </div>

      {/* Parent concepts if any */}
      {parentConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {parentConcepts.map((concept, i) => (
            <Badge
              key={`${concept}-${i}`}
              variant="secondary"
              className="px-2 py-0.5 text-xs font-medium rounded-md"
            >
              {concept}
            </Badge>
          ))}
        </div>
      )}

      {/* Sub Boxes / Primary Material */}
      {box.subBoxes && box.subBoxes.length > 0 ? (
        <SubBoxSection subBoxes={box.subBoxes} parentIndex={index + 1} />
      ) : box.boxType === "PRIMARY_MATERIAL" ? (
        <PrimaryMaterialSection />
      ) : null}
    </Card>
  );
});
