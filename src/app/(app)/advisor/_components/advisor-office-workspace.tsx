"use client";

import { BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <Skeleton className="h-8 w-64 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-4 h-96 rounded-xl" />
          <Skeleton className="lg:col-span-8 h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  const isReviewActive =
    sessionDetail.activeSessionId !== null &&
    sessionDetail.currentReport !== null;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              <BookOpen className="size-3.5" />
            </div>
            <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Danışmanın Çalışma Odası
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-normal">
            Word taslak pasajlarınızı teslim edin, sayfa denetimi ve editoryal
            rötuşları inceleyin, danışmanla canlı müzakere edin.
          </p>
        </div>

        {isReviewActive && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetToNewSubmission}
            className="gap-1.5 border-border bg-background hover:bg-muted text-foreground shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <ArrowLeft className="size-3.5" />
            <span>Yeni Taslak Teslimi</span>
          </Button>
        )}
      </div>

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
