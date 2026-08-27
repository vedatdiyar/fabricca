"use client";

import { ArrowRight } from "lucide-react";
import type { Matrix } from "@/core/db/schema";
import { Button } from "@/components/ui/button";
import { useMatrixOnboarding } from "../_hooks/use-matrix-onboarding";
import { MatrixModeToolbar } from "./matrix-mode-toolbar";
import { AdvisorChat } from "./advisor-chat";
import { MatrixModalView } from "./matrix-modal-view";
import { MatrixForm } from "./matrix-form";
import { MatrixReviewModal } from "./matrix-review-modal";

interface MatrixOnboardingContainerProps {
  initialMatrix?: Matrix | null;
}

/**
 * Main orchestrator container for Onboarding Step 1 (Alternative 1: Chat-First + Top HUD).
 * Provides a focused, single-column conversational studio with a persistent top HUD strip,
 * on-demand single-quadrant modal inspection, and standard bottom-right proceed button.
 */
export function MatrixOnboardingContainer({
  initialMatrix,
}: MatrixOnboardingContainerProps) {
  const {
    activeMode,
    setActiveMode,
    selectedSegment,
    setSelectedSegment,
    isReviewOpen,
    setIsReviewOpen,
    matrix,
    messages,
    isLoading,
    streamingText,
    statusMessage,
    isSubmitting,
    isSyncing,
    readiness,
    handleSyncFromChat,
    handleSendMessage,
    handleEditSubmit,
    handleFieldChange,
    handleSubmitMatrix,
  } = useMatrixOnboarding(initialMatrix);

  return (
    <div className="w-full space-y-3">
      {/* Studio Toolbar: Mode Switcher */}
      <MatrixModeToolbar activeMode={activeMode} onSelectMode={setActiveMode} />

      {/* Main Studio Viewport */}
      {activeMode === "classic" ? (
        <MatrixForm initialMatrix={matrix as Matrix} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col space-y-3 h-[calc(100vh-16rem)] min-h-[580px] max-h-[820px]">
            {/* Focused Single-Column Chat Stüdyosu */}
            <div className="flex-1 min-h-0">
              <AdvisorChat
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                streamingText={streamingText}
                statusMessage={statusMessage}
                onEditSubmit={handleEditSubmit}
              />
            </div>

            {/* Focused Single-Quadrant Inspection & Edit Modal */}
            <MatrixModalView
              isOpen={selectedSegment !== null}
              onOpenChange={(open) => {
                if (!open) setSelectedSegment(null);
              }}
              selectedField={selectedSegment}
              matrix={matrix}
              onFieldChange={handleFieldChange}
            />
          </div>

          {/* Bottom Row - Step 1: Preview */}
          <div className="flex justify-end pt-1 pb-4">
            <Button
              type="button"
              onClick={() => setIsReviewOpen(true)}
              className="h-10 text-sm px-5 rounded-md border border-border bg-card hover:bg-accent text-foreground font-medium shadow-sm cursor-pointer inline-flex items-center gap-2"
            >
              <span className="inline-flex items-center gap-2">
                Tez matrisini gör
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-secondary border border-border">
                  {readiness.completedCount}/4
                </span>
                <ArrowRight className="size-4" />
              </span>
            </Button>
          </div>

          {/* Review Modal: 4 quadrants stacked + Mühürle ve İlerle inside */}
          <MatrixReviewModal
            isOpen={isReviewOpen}
            onOpenChange={setIsReviewOpen}
            matrix={matrix}
            completedCount={readiness.completedCount}
            isFullyReady={readiness.isFullyReady}
            isSubmitting={isSubmitting}
            isSyncing={isSyncing}
            onSyncFromChat={handleSyncFromChat}
            onConfirm={handleSubmitMatrix}
          />
        </div>
      )}
    </div>
  );
}
