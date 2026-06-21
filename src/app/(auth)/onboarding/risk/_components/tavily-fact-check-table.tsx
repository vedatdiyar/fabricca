"use client";

import { ShieldCheck, FileText, ExternalLink } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { OriginalityReportData } from "@/lib/types";

/** Turkish display labels for Tavily verification verdicts. */
const tavilyStatusTranslation: Record<string, string> = {
  VERIFIED: "Doğrulandı.",
  PARTIALLY_VERIFIED: "Kısmen Doğrulandı.",
  REFUTED: "Yanlışlandı.",
};

/** Badge color classes for Tavily verdicts (bg/border soft, text 100% opaque). */
const tavilyBadgeColor: Record<string, string> = {
  VERIFIED: "bg-success/10 border-success/20 text-success",
  PARTIALLY_VERIFIED: "bg-warning/10 border border-warning/20 text-warning",
  REFUTED: "bg-destructive/10 border-destructive/20 text-destructive",
};

interface TavilyFactCheckTableProps {
  /** Tavily factual-verification results (briefing note + items). */
  tavilyResults: OriginalityReportData["tavilyResults"];
}

/**
 * Renders Section A of the originality report: the Tavily factual-verification
 * briefing note and the table of fact-checked claims with their verdicts and
 * source links.
 */
export function TavilyFactCheckTable({
  tavilyResults,
}: TavilyFactCheckTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Maddi Doğrulama ve Bilgi Güvencesi
        </CardTitle>
        <CardDescription>
          Tez matrisindeki olgusal iddialar ve tarihsel verilerin arama motoru
          sonuçlarıyla doğrulanması.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-muted border border-border rounded-lg text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
          <span className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Doğrulama Özeti ve Analiz Notu
          </span>
          {tavilyResults.briefingNote}
        </div>

        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="p-3 text-xs font-normal text-muted-foreground tracking-wider uppercase w-[300px]">
                  Sorgulanan İfade / Olay
                </th>
                <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[280px]">
                  Doğrulama Sonucu
                </th>
                <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[80px]">
                  Kaynak
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tavilyResults.items?.map((item, idx) => {
                const isKnownEnum = [
                  "VERIFIED",
                  "PARTIALLY_VERIFIED",
                  "REFUTED",
                ].includes(item.result);
                return (
                  <tr key={idx} className="hover:bg-muted transition-colors">
                    <td className="p-3 text-sm font-normal text-foreground leading-relaxed">
                      {item.fact}
                    </td>
                    <td className="p-3 text-left max-w-[320px]">
                      {isKnownEnum ? (
                        <div className="space-y-2">
                          <span
                            className={`inline-flex border px-2 py-0.5 rounded text-[11px] font-medium tracking-wide ${tavilyBadgeColor[item.result] ?? "bg-primary/10 border border-primary/20 text-primary"}`}
                          >
                            {tavilyStatusTranslation[item.result]}
                          </span>
                          {item.resultNote && (
                            <p className="text-muted-foreground font-light text-xs leading-relaxed">
                              {item.resultNote}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground leading-relaxed">
                          {item.result}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:text-primary transition-colors font-medium text-xs"
                        >
                          Git <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
