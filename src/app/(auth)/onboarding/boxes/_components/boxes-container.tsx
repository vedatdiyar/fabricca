"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
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
import { confirmBoxesAction } from "../actions";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { GeminiThesisBox, RelatedThesisEntry } from "@/lib/types";
import { calculateBadge } from "@/lib/academic/badge-calculator";

const boxTypeOrder: Record<string, number> = {
  CONCEPTUAL: 1,
  PROBLEMATIZATION: 2,
  PRIMARY_MATERIAL: 3,
  DATA_PROTOCOL: 4,
  RELATED_THESES: 5,
};

const badgeLabels: Record<string, string> = {
  CONCEPTUAL: "Teorik Çatı",
  PROBLEMATIZATION: "Problematizasyon",
  PRIMARY_MATERIAL: "Birincil Malzeme",
  DATA_PROTOCOL: "Metodoloji",
  RELATED_THESES: "İlişkisel Tezler",
};

export function BoxesContainer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const { boxes, setBoxes } = useOnboardingStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) Check Zustand cache first — boxes are set here by the risk page's
      //    proceed flow (handleProceed). This prevents the DB fallback from
      //    overwriting the in-memory data with null.
      const cached = useOnboardingStore.getState().boxes;
      if (cached && cached.length > 0) {
        if (!cancelled) setLoading(false);
        return;
      }

      // 2) Fall back to the database.
      const { fetchBoxesWithFullShape } =
        await import("../../_lib/fetch-actions");
      const existing = await fetchBoxesWithFullShape();
      if (!cancelled) {
        if (existing.length > 0) {
          setBoxes(existing);
        } else {
          // No boxes anywhere — redirect to risk page to generate them.
          router.replace("/onboarding/risk");
          return;
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, setBoxes]);

  const handleConfirm = useCallback(async () => {
    if (!boxes) return;
    setConfirming(true);

    try {
      const result = await confirmBoxesAction(boxes);
      if ("error" in result && result.error) {
        toast.error(result.error);
        setConfirming(false);
        return;
      }

      const store = useOnboardingStore.getState();
      store.clearDownstreamData("boxes");

      setConfirming(false);
      toast.success(
        "Konu kutuları kaydedildi. Literatür taramasına geçiliyor.",
      );
      router.push("/onboarding/literature-review");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
      setConfirming(false);
    }
  }, [boxes, router]);

  if (loading) {
    return <LoadingSpinner variant="full" message="Kutular yükleniyor..." />;
  }

  // Defensive guard: boxes should never be null here (the mount useEffect
  // either restores them from Zustand/DB or redirects to the risk page).
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
        <Button onClick={handleConfirm} disabled={confirming} size="lg">
          {confirming ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Kutuları Onayla ve Literatür Taramasını Başlat
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Örtüşme seviyesi için Türkçe etiket.
 */
const axisLevelLabel: Record<string, string> = {
  KRITIK: "Kritik",
  ORTA: "Orta",
  OZGUN: "Özgün",
};

/**
 * Eksen adı için Türkçe etiket.
 */
const axisNameLabel: Record<string, string> = {
  subject: "Konu",
  theory: "Kuram",
  methodology: "Yöntem",
  context: "Bağlam",
};

/**
 * Rozet seviyesi için Türkçe etiket.
 */
const badgeLabel: Record<string, string> = {
  IKIZ: "İkiz Tez",
  SINIRDAS: "Sınırdaş Tez",
  OZGUN: "Özgün",
};

/**
 * Bir örtüşen tez kaydını kart olarak görüntüler.
 */
function RelatedThesisCard({ thesis }: { thesis: RelatedThesisEntry }) {
  const badge = calculateBadge(thesis.axes);

  return (
    <div className="border border-border/60 rounded-md p-3 space-y-2 bg-card/30">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-snug">
            {thesis.title}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {thesis.author} — {thesis.university} ({thesis.year})
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
            badge === "IKIZ"
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : badge === "SINIRDAS"
                ? "bg-warning/10 border-warning/30 text-warning"
                : "bg-success/10 border-success/30 text-success"
          }`}
        >
          {badgeLabel[badge]}
        </span>
      </div>

      {thesis.thesisType && (
        <p className="text-[10px] text-muted-foreground">
          {thesis.thesisType} · {thesis.department}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(["subject", "theory", "methodology", "context"] as const).map(
          (axis) => {
            const level = thesis.axes[axis];
            if (!level) return null;
            return (
              <span
                key={axis}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  level === "KRITIK"
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : level === "ORTA"
                      ? "bg-warning/10 border-warning/20 text-warning"
                      : "bg-success/10 border-success/20 text-success"
                }`}
              >
                {axisNameLabel[axis]}: {axisLevelLabel[level]}
              </span>
            );
          },
        )}
      </div>

      {thesis.comparisonNote && (
        <p className="text-[10px] text-muted-foreground leading-relaxed italic border-t border-border/20 pt-2">
          {thesis.comparisonNote}
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

      {box.concepts && box.concepts.length > 0 && (
        <div className="row-3">
          <div className="border-y border-border py-3">
            <div className="flex flex-wrap gap-2">
              {box.concepts.map((concept, i) => (
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

      {box.foundationalQueries && box.foundationalQueries.length > 0 ? (
        <div className="row-4 border-t border-border/40 pt-4 space-y-4">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Library className="w-3.5 h-3.5 text-primary" />
            Kurucu Literatür Temeli
          </h4>
          <ul className="space-y-2 pl-0.5">
            {box.foundationalQueries.slice(0, 3).map((fq, i) => (
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
