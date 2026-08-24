"use client";

import { Layers, Clock, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfficeMarginNotes } from "../office-margin-notes";
import { OfficeDefenseModal } from "./office-defense-modal";
import { OfficeActionToolbar } from "../office-action-toolbar";
import type { DefenseMessage } from "../office-defense-chat";
import type {
  OfficeReviewReport,
  JuryCritique,
} from "../../_services/pipeline/types";

interface OfficeReviewPhaseProps {
  activeOutlineId: number | null;
  activeOutlineTitle: string;
  currentReport: OfficeReviewReport;
  isDefenseModalOpen: boolean;
  defenseMessages: DefenseMessage[];
  hasStartedDefense: boolean;
  isStreamingDefense: boolean;
  activeCritique: JuryCritique | null;
  onDefenseModalOpenChange: (open: boolean) => void;
  onStartDefense: (critique?: JuryCritique) => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
  onResetToNewSubmission: () => void;
}

/**
 * Review workspace in single-column layout with modal-based live defense (Phase 2).
 *
 * @param props - Component props.
 * @returns Rendered review phase markup.
 */
export function OfficeReviewPhase({
  activeOutlineId,
  activeOutlineTitle,
  currentReport,
  isDefenseModalOpen,
  defenseMessages,
  hasStartedDefense,
  isStreamingDefense,
  activeCritique,
  onDefenseModalOpenChange,
  onStartDefense,
  onSendMessage,
  onResetToNewSubmission,
}: OfficeReviewPhaseProps) {
  const handleOpenDefenseModal = () => {
    if (!hasStartedDefense) {
      onStartDefense(activeCritique || undefined);
    } else {
      onDefenseModalOpenChange(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Layers className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-foreground">
              {activeOutlineTitle}
            </h2>
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-0.5">
              <Clock className="size-3" />
              <span>Hocanın Ön Okuması & Kenar Notları Masası</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            size="sm"
            onClick={handleOpenDefenseModal}
            className="text-xs h-8 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer px-3.5"
          >
            <Swords className="size-3.5" />
            <span>Danışmanla Canlı Müzakere Masası</span>
            {defenseMessages.length > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary-foreground/20 text-primary-foreground ml-0.5">
                {defenseMessages.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Single Column Full-Width Margin Notes */}
      <div className="w-full min-h-[600px]">
        <OfficeMarginNotes
          report={currentReport}
          onStartDefense={onStartDefense}
        />
      </div>

      {/* Persistent Bottom Action Toolbar */}
      <OfficeActionToolbar
        outlineId={activeOutlineId || 0}
        outlineTitle={activeOutlineTitle || "Tez Bölümü"}
        report={currentReport}
        defenseMessages={defenseMessages}
        onResetToNewSubmission={onResetToNewSubmission}
      />

      {/* Live Socratic Defense Modal */}
      <OfficeDefenseModal
        open={isDefenseModalOpen}
        onOpenChange={onDefenseModalOpenChange}
        activeOutlineTitle={activeOutlineTitle}
        activeCritique={activeCritique}
        defenseMessages={defenseMessages}
        hasStartedDefense={hasStartedDefense}
        isStreamingDefense={isStreamingDefense}
        onStartDefense={onStartDefense}
        onSendMessage={onSendMessage}
      />
    </div>
  );
}
