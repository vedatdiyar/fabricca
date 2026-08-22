"use client";

import { Layers, Clock } from "lucide-react";
import { OfficeMarginNotes } from "../office-margin-notes";
import { OfficeDefenseChat, type DefenseMessage } from "../office-defense-chat";
import { OfficeActionToolbar } from "../office-action-toolbar";
import type {
  OfficeReviewReport,
  JuryCritique,
} from "../../_services/pipeline/types";

interface OfficeReviewPhaseProps {
  activeOutlineId: number | null;
  activeOutlineTitle: string;
  currentReport: OfficeReviewReport;
  mobileWorkspaceTab: "margin-notes" | "defense-chat";
  defenseMessages: DefenseMessage[];
  hasStartedDefense: boolean;
  isStreamingDefense: boolean;
  activeCritique: JuryCritique | null;
  onMobileTabChange: (tab: "margin-notes" | "defense-chat") => void;
  onStartDefense: (critique?: JuryCritique) => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
  onResetToNewSubmission: () => void;
}

/**
 * Review & defense split workspace (Phase 2).
 *
 * @param props - Component props.
 * @returns Rendered review phase markup.
 */
export function OfficeReviewPhase({
  activeOutlineId,
  activeOutlineTitle,
  currentReport,
  mobileWorkspaceTab,
  defenseMessages,
  hasStartedDefense,
  isStreamingDefense,
  activeCritique,
  onMobileTabChange,
  onStartDefense,
  onSendMessage,
  onResetToNewSubmission,
}: OfficeReviewPhaseProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border text-xs">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-foreground">
            {activeOutlineTitle}
          </span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
          <Clock className="h-3.5 w-3.5" />
          <span>Danışman Ofis Masası</span>
        </div>
      </div>

      <div className="flex items-center rounded-lg border border-border bg-card p-1 text-xs lg:hidden">
        <button
          type="button"
          onClick={() => onMobileTabChange("margin-notes")}
          className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
            mobileWorkspaceTab === "margin-notes"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Kenar Notları & Denetim
        </button>
        <button
          type="button"
          onClick={() => onMobileTabChange("defense-chat")}
          className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
            mobileWorkspaceTab === "defense-chat"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Canlı Savunma Masası{" "}
          {defenseMessages.length > 0 ? `(${defenseMessages.length})` : ""}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden flex flex-col lg:flex-row h-[660px]">
        <div
          className={`w-full lg:w-1/2 h-full border-b lg:border-b-0 lg:border-r border-border overflow-hidden ${
            mobileWorkspaceTab === "margin-notes" ? "block" : "hidden lg:block"
          }`}
        >
          <OfficeMarginNotes
            report={currentReport}
            hasStartedDefense={hasStartedDefense}
            onStartDefense={onStartDefense}
          />
        </div>

        <div
          className={`w-full lg:w-1/2 h-full overflow-hidden ${
            mobileWorkspaceTab === "defense-chat" ? "block" : "hidden lg:block"
          }`}
        >
          <OfficeDefenseChat
            messages={defenseMessages}
            isStreaming={isStreamingDefense}
            onSendMessage={onSendMessage}
            hasStartedDefense={hasStartedDefense}
            onStartDefense={onStartDefense}
            activeCritique={activeCritique}
          />
        </div>
      </div>

      <OfficeActionToolbar
        outlineId={activeOutlineId || 0}
        outlineTitle={activeOutlineTitle || "Tez Bölümü"}
        report={currentReport}
        defenseMessages={defenseMessages}
        onResetToNewSubmission={onResetToNewSubmission}
      />
    </div>
  );
}
