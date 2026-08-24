"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Swords,
  BookCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { OfficeAuditTab } from "./office/margin-notes/office-audit-tab";
import { OfficeDiffTab } from "./office/margin-notes/office-diff-tab";
import { OfficeJuryTab } from "./office/margin-notes/office-jury-tab";
import type {
  OfficeReviewReport,
  JuryCritique,
} from "../_services/pipeline/types";

interface OfficeMarginNotesProps {
  report: OfficeReviewReport;
  onStartDefense: (initialCritique?: JuryCritique) => void;
}

/**
 * Margin Notes & Audit (Hocanın Ön Okuması & Kenar Notları).
 * Displays:
 * 1. Strict Citation & Page Audit (Sayfa Denetimi)
 * 2. Non-destructive Polish Diff (Editoryal Diff)
 * 3. Jury Remarks & Socratic Critiques (Jüri Şerhleri)
 */
export function OfficeMarginNotes({
  report,
  onStartDefense,
}: OfficeMarginNotesProps) {
  const [activeTab, setActiveTab] = useState<"audit" | "diff" | "jury">(
    "audit",
  );
  const [copiedDiff, setCopiedDiff] = useState(false);

  const { audit, diff, juryCritiques } = report;

  const handleCopyPolishedText = async () => {
    if (!diff.polished) return;
    await navigator.clipboard.writeText(diff.polished);
    setCopiedDiff(true);
    toast.success("Rötuşlanmış metin panoya kopyalandı.");
    setTimeout(() => setCopiedDiff(false), 2000);
  };

  return (
    <div className="flex h-full flex-col min-h-0 bg-card rounded-lg border border-border overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
              <BookCheck className="size-4" />
            </div>
            <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
              Hocanın Ön Okuması & Kenar Notları
            </h3>
          </div>

          {audit.hasCriticalIssues ? (
            <Badge
              variant="outline"
              className="bg-destructive/10 text-destructive border-destructive/20 text-xs font-medium px-2.5 py-0.5 rounded-md"
            >
              <AlertTriangle className="size-3 mr-1" />
              Kritik Şerhler Var
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-xs font-medium px-2.5 py-0.5 rounded-md"
            >
              <CheckCircle2 className="size-3 mr-1" />
              Kaynaklar Doğrulandı
            </Badge>
          )}
        </div>

        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "audit" | "diff" | "jury")}
          className="mt-3.5 w-full"
        >
          <TabsList className="grid grid-cols-3 w-full bg-secondary/80 h-9 p-1 rounded-md border border-border/60">
            <TabsTrigger
              value="audit"
              className="text-xs font-medium h-7 rounded-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all cursor-pointer"
            >
              <ShieldAlert className="size-3.5 mr-1.5 text-destructive" />
              <span>Kaynak & Atıf Denetimi</span>
              {audit.findings.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 font-mono text-[10px] bg-secondary text-foreground rounded-full border border-border/60">
                  {audit.findings.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="diff"
              className="text-xs font-medium h-7 rounded-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="size-3.5 mr-1.5 text-primary" />
              <span>Akademik Üslup & Rötuş</span>
            </TabsTrigger>

            <TabsTrigger
              value="jury"
              className="text-xs font-medium h-7 rounded-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all cursor-pointer"
            >
              <Swords className="size-3.5 mr-1.5 text-warning" />
              <span>Jüri Şerhleri & Savunma</span>
              {juryCritiques.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 font-mono text-[10px] bg-secondary text-foreground rounded-full border border-border/60">
                  {juryCritiques.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {activeTab === "audit" && <OfficeAuditTab audit={audit} />}
        {activeTab === "diff" && (
          <OfficeDiffTab
            diff={diff}
            onCopyPolished={handleCopyPolishedText}
            copiedDiff={copiedDiff}
          />
        )}
        {activeTab === "jury" && (
          <OfficeJuryTab
            juryCritiques={juryCritiques}
            onStartDefense={onStartDefense}
          />
        )}
      </div>
    </div>
  );
}
