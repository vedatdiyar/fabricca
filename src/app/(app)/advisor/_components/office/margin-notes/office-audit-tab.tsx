"use client";

import { Check, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OfficeReviewReport } from "../../../_services/pipeline/types";

const SEVERITY_BADGES: Record<string, { label: string; variant: string }> = {
  CRITICAL: {
    label: "Kritik Çelişki",
    variant: "bg-destructive/10 text-destructive border-destructive/20",
  },
  WARNING: {
    label: "Uyarı",
    variant: "bg-warning/10 text-warning border-warning/20",
  },
  NOTE: {
    label: "Doğrulandı",
    variant: "bg-primary/10 text-primary border-primary/20",
  },
};

interface OfficeAuditTabProps {
  audit: OfficeReviewReport["audit"];
}

/**
 * Audit findings tab for margin notes.
 *
 * @param props - Component props.
 * @returns Rendered audit tab markup.
 */
export function OfficeAuditTab({ audit }: OfficeAuditTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-lg border border-border bg-muted/30 text-xs leading-relaxed text-foreground">
        <span className="font-semibold text-primary block mb-1">
          Danışman Denetim Kararı:
        </span>
        {audit.summary}
      </div>

      <div className="space-y-3">
        <h4 className="font-sans text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Kaynak & Sayfa Doğrulama Detayları
        </h4>

        {audit.findings.length === 0 ? (
          <div className="p-4 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground text-center">
            Taslakta açık bir atıf veya sayfa uyuşmazlığı tespit edilmedi.
          </div>
        ) : (
          audit.findings.map((f, idx) => {
            const badge = SEVERITY_BADGES[f.severity] || SEVERITY_BADGES.NOTE;
            const findingKey = `${f.sourceTitle ?? "src"}-${f.citedPages ?? ""}-${f.status}-${idx}`;

            return (
              <Card
                key={findingKey}
                className="border-border bg-card shadow-xs overflow-hidden"
              >
                <div className="p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${badge.variant}`}
                      >
                        {badge.label}
                      </Badge>

                      {f.citedPages && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-muted text-muted-foreground"
                        >
                          {f.citedPages}
                        </Badge>
                      )}
                    </div>

                    {f.status === "VERIFIED" ? (
                      <span className="text-[10px] text-primary flex items-center gap-1">
                        <Check className="h-3 w-3" /> Doğrulandı
                      </span>
                    ) : (
                      <span className="text-[10px] text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Uyumsuz / Şüpheli
                      </span>
                    )}
                  </div>

                  {f.sourceTitle && (
                    <div className="text-xs font-medium text-foreground">
                      {f.sourceTitle}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {f.message}
                  </p>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
