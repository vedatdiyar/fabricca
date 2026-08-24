"use client";

import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OfficeReviewReport } from "../../../_services/pipeline/types";

interface OfficeAuditTabProps {
  audit: OfficeReviewReport["audit"];
}

/**
 * Audit findings tab for margin notes.
 * High-contrast academic layout for citation and page verification.
 */
export function OfficeAuditTab({ audit }: OfficeAuditTabProps) {
  return (
    <div className="space-y-5">
      {/* Advisor Decision Card */}
      <div className="p-4 rounded-lg border border-primary/20 bg-card space-y-1.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary shrink-0" />
          <h3 className="font-serif text-sm font-semibold tracking-tight text-primary">
            Danışman Denetim Kararı
          </h3>
        </div>
        <p className="text-sm font-normal leading-relaxed text-foreground">
          {audit.summary}
        </p>
      </div>

      {/* Findings Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Kaynak & Sayfa Doğrulama Detayları
          </h4>
          <span className="font-mono text-xs text-muted-foreground">
            {audit.findings.length} Kayıt
          </span>
        </div>

        {audit.findings.length === 0 ? (
          <div className="p-6 rounded-lg bg-card border border-border text-sm text-foreground text-center">
            Taslakta açık bir atıf veya sayfa uyuşmazlığı tespit edilmedi.
          </div>
        ) : (
          audit.findings.map((f, idx) => {
            const isVerified = f.status === "VERIFIED";
            const isMismatch =
              f.status === "MISMATCH" || f.severity === "CRITICAL";
            const findingKey = `${f.sourceTitle ?? "src"}-${f.citedPages ?? ""}-${f.status}-${idx}`;

            return (
              <Card
                key={findingKey}
                className={`p-4 rounded-lg space-y-3 transition-all ${
                  isMismatch
                    ? "border-destructive/30 bg-card"
                    : isVerified
                      ? "border-border bg-card"
                      : "border-warning/30 bg-card"
                }`}
              >
                {/* Header: Status Badge + Page Tag */}
                <div className="flex items-center justify-between gap-3">
                  {isVerified ? (
                    <Badge
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/20 text-xs font-medium gap-1.5 px-2.5 py-0.5 rounded-md"
                    >
                      <CheckCircle2 className="size-3.5" /> Doğrulandı
                    </Badge>
                  ) : isMismatch ? (
                    <Badge
                      variant="outline"
                      className="bg-destructive/10 text-destructive border-destructive/20 text-xs font-medium gap-1.5 px-2.5 py-0.5 rounded-md"
                    >
                      <AlertCircle className="size-3.5" /> Sayfa Dışı Yargı /
                      Çelişki
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-warning/10 text-warning border-warning/20 text-xs font-medium gap-1.5 px-2.5 py-0.5 rounded-md"
                    >
                      <HelpCircle className="size-3.5" /> Doğrulanamadı
                    </Badge>
                  )}

                  {f.citedPages && (
                    <span className="text-xs font-mono font-semibold text-foreground bg-secondary px-2.5 py-0.5 rounded-md border border-border">
                      {f.citedPages}
                    </span>
                  )}
                </div>

                {/* Source Title */}
                {f.sourceTitle && (
                  <div className="flex items-center gap-2 text-foreground font-serif text-sm font-semibold">
                    <BookOpen className="size-4 text-primary shrink-0" />
                    <span>{f.sourceTitle}</span>
                  </div>
                )}

                {/* Finding Content */}
                <div className="p-3.5 rounded-md bg-secondary/50 border border-border/40">
                  <p className="text-sm font-normal leading-relaxed text-foreground">
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
