"use client";

import { Swords, AlertTriangle, Lightbulb } from "lucide-react";
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

function cleanEnumCodes(text: string): string {
  return text.replace(
    /\s*\((LOGIC_LEAP|UNBACKED_CLAIM|METHODOLOGICAL_GAP|MISMATCH|UNVERIFIED|CRITICAL|WARNING|NOTE)\)/gi,
    "",
  );
}

interface OfficeJuryTabProps {
  juryCritiques: JuryCritique[];
  onStartDefense: (initialCritique?: JuryCritique) => void;
}

/**
 * Jury critiques tab for margin notes.
 * High-contrast academic layout with clear Socratic defense triggers.
 */
export function OfficeJuryTab({
  juryCritiques,
  onStartDefense,
}: OfficeJuryTabProps) {
  return (
    <div className="space-y-5">
      {/* Top Notice Box */}
      <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 space-y-1.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning shrink-0" />
          <h3 className="font-serif text-sm font-semibold tracking-tight text-warning">
            Tez Savunması Provası
          </h3>
        </div>
        <p className="text-sm font-normal leading-relaxed text-foreground">
          Jüri üyelerinin tez savunmasında yöneltebileceği olası itirazlar ve
          metodolojik açıklar aşağıda sıralanmıştır. Bu şerhleri danışmanınızla
          canlı müzakere ederek savunma argümanlarınızı güçlendirebilirsiniz.
        </p>
      </div>

      {/* Critiques List */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Olası Jüri İtirazları & Savunma Çıkışları
          </h4>
          <span className="font-mono text-xs text-muted-foreground">
            {juryCritiques.length} Şerh
          </span>
        </div>

        {juryCritiques.length === 0 ? (
          <div className="p-6 rounded-lg bg-card border border-border text-sm text-foreground text-center">
            Belirgin bir jüri itiraz şerhi tespit edilmedi.
          </div>
        ) : (
          juryCritiques.map((critique, idx) => {
            const cat =
              CATEGORY_LABELS[critique.category] || CATEGORY_LABELS.LOGIC_LEAP;
            const critiqueKey = critique.id || `${critique.title}-${idx}`;

            return (
              <Card
                key={critiqueKey}
                className="p-4 rounded-lg bg-card border border-border space-y-3.5"
              >
                {/* Critique Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
                    {idx + 1}. {cleanEnumCodes(critique.title)}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium px-2.5 py-0.5 rounded-md shrink-0 self-start sm:self-auto ${cat.color}`}
                  >
                    {cat.label}
                  </Badge>
                </div>

                {/* Critique Content */}
                <div className="p-3.5 rounded-md bg-secondary/50 border border-border/40">
                  <p className="text-sm font-normal leading-relaxed text-foreground">
                    {cleanEnumCodes(critique.critique)}
                  </p>
                </div>

                {/* Suggested Defense Callout with Action */}
                <div className="p-3.5 rounded-md bg-primary/10 border border-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <Lightbulb className="size-3.5 shrink-0" />
                      Önerilen Savunma Argümanı
                    </span>
                    <p className="text-sm font-normal leading-relaxed text-foreground">
                      {cleanEnumCodes(critique.suggestedDefensePoint)}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => onStartDefense(critique)}
                    className="h-8 text-xs font-medium px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shrink-0 gap-1.5 cursor-pointer shadow-xs self-start md:self-auto"
                  >
                    <Swords className="size-3.5" />
                    <span>Savunmada Bu Şerhi Tartış</span>
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
