"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { OfficeReviewPhase } from "./office/office-review-phase";
import { OfficeSubmissionPhase } from "./office/office-submission-phase";
import { useAdvisorOfficeWorkspace } from "../_hooks/use-advisor-office-workspace";

interface AdvisorOfficeWorkspaceProps {
  initialSessionId?: number;
}

/**
 * Root workspace for Danışmanın Çalışma Odası (Office Hours & Draft Audit Desk).
 *
 * @param props - Component props.
 * @returns Rendered workspace markup.
 */
export function AdvisorOfficeWorkspace({
  initialSessionId,
}: AdvisorOfficeWorkspaceProps) {
  const {
    initialData,
    setInitialData,
    sessionDetail,
    defenseState,
    uiState,
    setUiState,
    loadSessionDetail,
    handleReviewSubmit,
    handleStartDefense,
    handleSendDefenseMessage,
    handleResetToNewSubmission,
  } = useAdvisorOfficeWorkspace(initialSessionId);

  if (initialData.isLoading) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100dvh-9.5rem)] lg:min-h-[460px]">
          <Skeleton className="lg:col-span-4 h-full rounded-lg" />
          <Skeleton className="lg:col-span-8 h-full rounded-lg" />
        </div>
      </div>
    );
  }

  const isReviewActive =
    sessionDetail.activeSessionId !== null &&
    sessionDetail.currentReport !== null;

  return (
    <div className="w-full">
      {isReviewActive && sessionDetail.currentReport ? (
        <OfficeReviewPhase
          activeOutlineId={sessionDetail.activeOutlineId}
          activeOutlineTitle={sessionDetail.activeOutlineTitle}
          currentReport={sessionDetail.currentReport}
          isDefenseModalOpen={uiState.isDefenseModalOpen}
          defenseMessages={defenseState.messages}
          hasStartedDefense={defenseState.hasStarted}
          isStreamingDefense={defenseState.isStreaming}
          activeCritique={defenseState.activeCritique}
          onDefenseModalOpenChange={(open) =>
            setUiState((prev) => ({ ...prev, isDefenseModalOpen: open }))
          }
          onStartDefense={handleStartDefense}
          onSendMessage={(text) => handleSendDefenseMessage(text)}
          onResetToNewSubmission={handleResetToNewSubmission}
        />
      ) : (
        <OfficeSubmissionPhase
          sessions={initialData.sessions}
          outlines={initialData.outlines}
          activeSessionId={sessionDetail.activeSessionId}
          mobileSubmissionTab={uiState.mobileSubmissionTab}
          isSubmittingReview={uiState.isSubmittingReview}
          onMobileTabChange={(tab) =>
            setUiState((prev) => ({ ...prev, mobileSubmissionTab: tab }))
          }
          onSelectSession={(id) => loadSessionDetail(id, initialData.outlines)}
          onNewSession={handleResetToNewSubmission}
          onSessionDeleted={(deletedId) => {
            setInitialData((prev) => ({
              ...prev,
              sessions: prev.sessions.filter((s) => s.id !== deletedId),
            }));
            if (sessionDetail.activeSessionId === deletedId) {
              handleResetToNewSubmission();
            }
          }}
          onSubmitReview={handleReviewSubmit}
        />
      )}
    </div>
  );
}
