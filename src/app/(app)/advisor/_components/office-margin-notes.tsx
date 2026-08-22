"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Swords,
  BookCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  hasStartedDefense: boolean;
  onStartDefense: (initialCritique?: JuryCritique) => void;
}

/**
 * Left Panel: Margin Notes & Audit (Hocanın Ön Okuması & Kenar Notları).
 * Displays:
 * 1. Strict Citation & Page Audit (Red Pen)
 * 2. Non-destructive Polish Diff (Yellow Pen)
 * 3. Jury Remarks & Socratic Critiques (Blue Pen)
 */
export function OfficeMarginNotes({
  report,
  hasStartedDefense,
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
    <div className="flex flex-col h-full bg-card border-r border-border overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-border bg-card/80 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookCheck className="h-4 w-4 text-primary" />
            <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
              Hocanın Ön Okuması & Kenar Notları
            </h3>
          </div>

          {audit.hasCriticalIssues ? (
            <Badge
              variant="outline"
              className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Kritik Şerhler Var
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-[10px]"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Kaynaklar Doğrulandı
            </Badge>
          )}
        </div>

        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "audit" | "diff" | "jury")}
          className="mt-3 w-full"
        >
          <TabsList className="grid grid-cols-3 w-full bg-muted/60 h-8 p-0.5">
            <TabsTrigger
              value="audit"
              className="text-xs h-7 data-[state=active]:bg-background data-[state=active]:text-foreground cursor-pointer"
            >
              <ShieldAlert className="h-3 w-3 mr-1 text-destructive" />
              Sayfa Denetimi
              {audit.findings.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-muted text-[10px] rounded-full">
                  {audit.findings.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="diff"
              className="text-xs h-7 data-[state=active]:bg-background data-[state=active]:text-foreground cursor-pointer"
            >
              <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
              Editoryal Diff
            </TabsTrigger>

            <TabsTrigger
              value="jury"
              className="text-xs h-7 data-[state=active]:bg-background data-[state=active]:text-foreground cursor-pointer"
            >
              <Swords className="h-3 w-3 mr-1 text-blue-500" />
              Jüri Şerhleri
              {juryCritiques.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-muted text-[10px] rounded-full">
                  {juryCritiques.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

      {/* Panel Footer: Start Live Defense CTA */}
      {!hasStartedDefense && (
        <div className="p-4 border-t border-border bg-card/90 shrink-0">
          <Button
            onClick={() => onStartDefense()}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium h-9 gap-2 shadow-xs cursor-pointer"
          >
            <Swords className="h-4 w-4" />
            <span>Savunmaya Başla (Danışmanla Müzakere Et)</span>
            <ArrowRight className="h-3.5 w-3.5 ml-auto" />
          </Button>
        </div>
      )}
    </div>
  );
}
