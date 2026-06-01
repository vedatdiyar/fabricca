"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Feather } from "lucide-react";
import { useOnboardingLogic } from "./_hooks/use-onboarding-logic";
import { ChatScreen } from "./_components/chat-screen";
import { PreviewScreen } from "./_components/preview-screen";

function OnboardingHeader() {
  return (
    <div className="border-b border-border p-4 md:p-5 bg-card flex items-center justify-between shrink-0">
      <div className="flex items-center space-x-3">
        <div className="bg-secondary p-2 rounded-lg border border-border">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground font-sans">
            Prof. Dr. Verita ile Tez Mülakatı
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Tez anayasasını hazırlamak için serbest bir akademik diyalog
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-muted-foreground">
        <Feather className="h-4 w-4 text-primary" />
        <span className="text-xs font-sans hidden md:block">
          Sözel onay verdiğinde anayasa basılır
        </span>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const {
    state,
    setUserResponse,
    handleSubmit,
    handleConfirmSave,
    handleApproveConstitution,
    handleReset,
  } = useOnboardingLogic(router);

  return (
    <div className="flex flex-col bg-background px-4 py-4 items-center justify-center h-screen w-full overflow-hidden">
      <div className="w-full max-w-5xl border border-border bg-card rounded-lg shadow-2xl relative overflow-hidden flex flex-col h-[90vh]">
        {/* Bottom decorative bar is top line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

        <OnboardingHeader />

        {/* 1. INTERACTIVE CHAT SCREEN */}
        {state.isChatActive && (
          <ChatScreen
            messages={state.messages}
            userResponse={state.userResponse}
            setUserResponse={setUserResponse}
            isLoading={state.isLoading}
            isOriginalityLoading={state.isOriginalityLoading}
            error={state.error}
            handleSubmit={handleSubmit}
            pendingStructuredData={state.pendingStructuredData}
            onApproveConstitution={handleApproveConstitution}
          />
        )}

        {/* 2. STRUCTURED PREVIEW & CONFIRMATION SCREEN */}
        {!state.isChatActive && state.structuredData && (
          <PreviewScreen
            structuredData={state.structuredData}
            isSaving={state.isSaving}
            error={state.error}
            handleConfirmSave={handleConfirmSave}
            handleReset={handleReset}
            messages={state.messages}
          />
        )}
      </div>
    </div>
  );
}
