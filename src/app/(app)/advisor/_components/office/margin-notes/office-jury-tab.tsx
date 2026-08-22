"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { JuryCritique } from "../../../_services/pipeline/types";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  LOGIC_LEAP: {
    label: "Mantık Sıçraması",
    color: "bg-warning/10 text-warning border-warning/20",
  },
  UNBACKED_CLAIM: {
    label: "Temellendirilmemiş İddia",
    color: "bg-warning/10 text-warning border-warning/20",
  },
  METHODOLOGICAL_GAP: {
    label: "Metodolojik Boşluk",
    color: "bg-warning/10 text-warning border-warning/20",
  },
};

interface OfficeJuryTabProps {
  juryCritiques: JuryCritique[];
  onStartDefense: (initialCritique?: JuryCritique) => void;
}

/**
 * Jury critiques tab for margin notes.
 *
 * @param props - Component props.
 * @returns Rendered jury tab markup.
 */
export function OfficeJuryTab({
  juryCritiques,
  onStartDefense,
}: OfficeJuryTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground block mb-0.5">
          Tez Savunması Provası:
        </span>
        Jüri üyelerinin tez savunmasında yöneltebileceği olası itirazlar aşağıda
        sıralanmıştır. Bu şerhleri danışmanınızla canlı olarak müzakere
        edebilirsiniz.
      </div>

      <div className="space-y-3">
        {juryCritiques.length === 0 ? (
          <div className="p-4 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground text-center">
            Belirgin bir jüri itiraz şerhi bulunamadı.
          </div>
        ) : (
          juryCritiques.map((critique, idx) => {
            const cat =
              CATEGORY_LABELS[critique.category] || CATEGORY_LABELS.LOGIC_LEAP;
            const critiqueKey = critique.id || `${critique.title}-${idx}`;

            return (
              <Card
                key={critiqueKey}
                className="border-border bg-card shadow-xs overflow-hidden"
              >
                <div className="p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {idx + 1}. {critique.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${cat.color}`}
                    >
                      {cat.label}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {critique.critique}
                  </p>

                  <div className="p-2.5 rounded-md bg-muted/50 border border-border/80 text-[11px] leading-relaxed text-foreground">
                    <span className="font-semibold text-primary block mb-0.5">
                      💡 Önerilen Savunma Argümanı:
                    </span>
                    {critique.suggestedDefensePoint}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onStartDefense(critique)}
                    className="self-end text-xs text-primary hover:text-primary hover:bg-primary/10 h-7 px-2 gap-1 cursor-pointer"
                  >
                    <span>Savunmada Bu Şerhi Tartış</span>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
