"use client";

import {
  Sparkles,
  Layers,
  Copy,
  Check,
  Loader2,
  ListOrdered,
  Pin,
  X,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { CitationSynthesisReport } from "../ai-actions";
import type { CitationCardItem, OutlineItem, SourceItem } from "../_lib/types";
import { useCitationSynthesisLogic } from "../_hooks/use-citation-synthesis";
import { SynthesisClustersTab } from "./synthesis/synthesis-clusters-tab";
import { SynthesisFlowTab } from "./synthesis/synthesis-flow-tab";
import { CitationSynthesisPanelHeader } from "./synthesis/synthesis-panel-header";

interface CitationSynthesisViewProps {
  cards: CitationCardItem[];
  outlines: OutlineItem[];
  sources: SourceItem[];
  selectedOutlineId: number | null;
  onRefreshData: () => Promise<void>;
  onClose: () => void;
}

/**
 * In-place Fikir & Sentez Düzenleyici Panel.
 * Renders directly inside the active section workspace on /citation-cards.
 */

/**
 * In-place Fikir & Sentez Düzenleyici Panel.
 * Renders directly inside the active section workspace on /citation-cards.
 */
export function CitationSynthesisView(props: CitationSynthesisViewProps) {
  const {
    synthesisState,
    setSynthesisState,
    sourceMap,
    cardMap,
    selectedOutline,
    handleRunSynthesis,
    handlePinClusterToOutline,
    handleCopyFlowForWord,
  } = useCitationSynthesisLogic(props);

  const report = synthesisState.report;

  return (
    <Card className="border-primary/30 bg-gradient-to-b from-primary/5 via-card to-card shadow-sm p-4 sm:p-5 flex flex-col gap-4">
      <CitationSynthesisPanelHeader
        selectedOutline={selectedOutline}
        report={report}
        isSynthesizing={synthesisState.isSynthesizing}
        onRunSynthesis={handleRunSynthesis}
        onClose={props.onClose}
      />

      {/* Synthesis Content or Loading */}
      {synthesisState.isSynthesizing ? (
        <div className="py-10 flex flex-col items-center justify-center text-center gap-2.5">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-medium">
            Alıntı fişleri anlamsal kümelere ayrılıyor ve Word yazım akışı
            hazırlanıyor...
          </span>
        </div>
      ) : !report ? (
        <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-xs text-muted-foreground">
            Sentez henüz oluşturulmadı.
          </p>
          <Button
            size="sm"
            onClick={handleRunSynthesis}
            className="bg-primary text-primary-foreground text-xs h-8 px-4 gap-1.5 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Şimdi Sentezle</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Sub-tabs: Clusters vs Argument Flow */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
            <Tabs
              value={synthesisState.activeTab}
              onValueChange={(v) =>
                setSynthesisState((prev) => ({
                  ...prev,
                  activeTab: v as "clusters" | "flow",
                }))
              }
              className="w-full sm:w-auto"
            >
              <TabsList className="bg-muted/60 h-8 p-0.5">
                <TabsTrigger
                  value="clusters"
                  className="text-xs h-7 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span>Semantik Fikir Kümeleri</span>
                  <span className="px-1.5 py-0.2 bg-muted text-[10px] rounded-full">
                    {report.clusters.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="flow"
                  className="text-xs h-7 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground cursor-pointer"
                >
                  <ListOrdered className="h-3.5 w-3.5 text-amber-500" />
                  <span>Word Argüman Akış Sırası</span>
                  <span className="px-1.5 py-0.2 bg-muted text-[10px] rounded-full">
                    {report.argumentFlow.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {synthesisState.activeTab === "flow" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyFlowForWord}
                className="text-xs h-7 gap-1.5 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 shrink-0 cursor-pointer"
              >
                {synthesisState.hasCopiedFlow ? (
                  <>
                    <Check className="h-3 w-3" />
                    <span>Kopyalandı!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Word Akışını Kopyala</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {/* TAB 1: SEMANTIC CLUSTERS */}
          {synthesisState.activeTab === "clusters" && (
            <SynthesisClustersTab
              clusters={report.clusters}
              cardMap={cardMap}
              sourceMap={sourceMap}
              onPinCluster={handlePinClusterToOutline}
              pinningClusterId={synthesisState.pinningClusterId}
            />
          )}

          {/* TAB 2: ARGUMENT FLOW FOR WORD */}
          {synthesisState.activeTab === "flow" && (
            <SynthesisFlowTab
              argumentFlow={report.argumentFlow}
              cardMap={cardMap}
              sourceMap={sourceMap}
            />
          )}
        </div>
      )}
    </Card>
  );
}
