"use client";

import { OfficeSubmissionForm } from "../office-submission-form";
import { OfficeSessionSidebar } from "../office-session-sidebar";
import type { OutlineOption, OfficeSessionSummary } from "../../office-actions";

interface OfficeSubmissionPhaseProps {
  sessions: OfficeSessionSummary[];
  outlines: OutlineOption[];
  activeSessionId: number | null;
  mobileSubmissionTab: "form" | "history";
  isSubmittingReview: boolean;
  onMobileTabChange: (tab: "form" | "history") => void;
  onSelectSession: (id: number) => void;
  onNewSession: () => void;
  onSessionDeleted: (id: number) => void;
  onSubmitReview: (data: {
    outlineId: number;
    draftText: string;
    studentNote?: string;
  }) => Promise<void>;
}

/**
 * Submission & history split view (Phase 1).
 *
 * @param props - Component props.
 * @returns Rendered submission phase markup.
 */
export function OfficeSubmissionPhase({
  sessions,
  outlines,
  activeSessionId,
  mobileSubmissionTab,
  isSubmittingReview,
  onMobileTabChange,
  onSelectSession,
  onNewSession,
  onSessionDeleted,
  onSubmitReview,
}: OfficeSubmissionPhaseProps) {
  return (
    <div className="flex flex-col gap-4">
      {sessions.length > 0 && (
        <div className="flex items-center rounded-lg border border-border bg-card p-1 text-xs lg:hidden">
          <button
            type="button"
            onClick={() => onMobileTabChange("form")}
            className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
              mobileSubmissionTab === "form"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yeni Taslak Teslimi
          </button>
          <button
            type="button"
            onClick={() => onMobileTabChange("history")}
            className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
              mobileSubmissionTab === "history"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Geçmiş Randevular ({sessions.length})
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div
          className={`lg:col-span-4 w-full ${
            mobileSubmissionTab === "history" ? "block" : "hidden lg:block"
          }`}
        >
          <OfficeSessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectSession}
            onNewSession={onNewSession}
            onSessionDeleted={onSessionDeleted}
          />
        </div>

        <div
          className={`lg:col-span-8 w-full ${
            mobileSubmissionTab === "form" ? "block" : "hidden lg:block"
          }`}
        >
          <OfficeSubmissionForm
            outlines={outlines}
            isSubmitting={isSubmittingReview}
            onSubmit={onSubmitReview}
          />
        </div>
      </div>
    </div>
  );
}
