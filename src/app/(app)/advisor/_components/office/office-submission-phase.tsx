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
  }) => Promise<void>;
}

/**
 * Master-Detail Submission Phase (Phase 1).
 * Left column: Past Sessions Sidebar (always equal height to the right panel).
 * Right column: Draft Submission Desk (compact, no dead vertical space).
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
  const onSelectAndSwitchMobile = (id: number) => {
    onSelectSession(id);
    onMobileTabChange("form");
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Mobile Switcher (Visible only below lg) */}
      <div className="flex items-center justify-between lg:hidden pb-1">
        <div className="flex items-center rounded-md border border-border bg-card p-1 text-xs w-full">
          <button
            type="button"
            onClick={() => onMobileTabChange("history")}
            className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
              mobileSubmissionTab === "history"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Randevular ({sessions.length})
          </button>
          <button
            type="button"
            onClick={() => onMobileTabChange("form")}
            className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
              mobileSubmissionTab === "form"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Taslak Masası
          </button>
        </div>
      </div>

      {/* Desktop Master-Detail Grid (Strictly equal heights via items-stretch) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-stretch">
        {/* Left Column: Sessions Sidebar */}
        <div
          className={`lg:col-span-4 flex flex-col min-h-0 h-full ${
            mobileSubmissionTab === "history" ? "block" : "hidden lg:flex"
          }`}
        >
          <OfficeSessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectAndSwitchMobile}
            onNewSession={onNewSession}
            onSessionDeleted={onSessionDeleted}
          />
        </div>

        {/* Right Column: Submission Desk */}
        <div
          className={`lg:col-span-8 flex flex-col min-h-0 h-full ${
            mobileSubmissionTab === "form" ? "block" : "hidden lg:flex"
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
