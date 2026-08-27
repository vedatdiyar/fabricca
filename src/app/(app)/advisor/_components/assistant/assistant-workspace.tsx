"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useAssistantWorkspace } from "../../_hooks/use-assistant-workspace";
import { AssistantSidebar } from "./assistant-sidebar";
import { AssistantMessageList } from "./assistant-message-list";
import { AssistantInput } from "./assistant-input";
import { AssistantCitationDialog } from "./assistant-citation-dialog";

interface AssistantWorkspaceProps {
  initialSessionId?: number;
}

/**
 * Main Thesis Assistant workspace layout adhering to the application's global
 * typography, container width, and padding system.
 *
 * @param props - Component props.
 * @param props.initialSessionId - Optional session ID loaded from search params.
 * @returns The rendered workspace markup.
 */
export function AssistantWorkspace({
  initialSessionId,
}: AssistantWorkspaceProps) {
  const [mobileTab, setMobileTab] = useState<"chat" | "sessions">("chat");

  const {
    sessions,
    activeSessionId,
    messages,
    isLoadingSessions,
    isLoadingMessages,
    isGenerating,
    streamingText,
    streamingSources,
    streamingPersona,
    streamingToolCalls,
    activeCitation,
    isCitationOpen,
    handleSelectSession,
    handleNewSession,
    handleDeleteSession,
    handleSendMessage,
    handleApproveTool,
    handleRejectTool,
    handleUndoTool,
    handleOpenCitation,
    handleCloseCitation,
  } = useAssistantWorkspace({ initialSessionId });

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="w-full flex flex-col lg:h-[calc(100dvh-9.5rem)] lg:min-h-[460px] space-y-4">
      {/* Mobile Master-Detail Tab Switcher (Visible only below lg) */}
      <div className="flex items-center justify-between lg:hidden pb-1 shrink-0">
        <div className="flex items-center rounded-md border border-border bg-card p-1 text-xs w-full">
          <button
            type="button"
            onClick={() => setMobileTab("sessions")}
            className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
              mobileTab === "sessions"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Konu Oturumları ({sessions.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
              mobileTab === "chat"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sohbet Alanı
          </button>
        </div>
      </div>

      {/* Desktop Master-Detail Grid — Strictly fills remaining height with zero outer scroll */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 min-h-0 items-stretch">
        {/* Left Column: Topic Sessions Sidebar */}
        <div
          className={`lg:col-span-4 flex flex-col min-h-0 h-full ${
            mobileTab === "sessions" ? "block" : "hidden lg:flex"
          }`}
        >
          <AssistantSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            isLoading={isLoadingSessions}
            onSelectSession={(id) => {
              handleSelectSession(id);
              setMobileTab("chat");
            }}
            onNewSession={() => {
              handleNewSession();
              setMobileTab("chat");
            }}
            onDeleteSession={handleDeleteSession}
          />
        </div>

        {/* Right Column: Chat History & Input */}
        <div
          className={`lg:col-span-8 flex flex-col min-h-0 h-full rounded-lg border border-border bg-card shadow-xs overflow-hidden ${
            mobileTab === "chat" ? "block" : "hidden lg:flex"
          }`}
        >
          {/* Active Session Header Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-md bg-primary/10 border border-primary/20 text-primary shrink-0">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif text-base font-semibold tracking-tight text-foreground truncate">
                  {activeSession?.title || "Yeni Sohbet"}
                </h2>
                <p className="text-xs text-muted-foreground font-sans truncate">
                  {activeSession
                    ? `${messages.length} mesaj • ${activeSession.createdAt}`
                    : "Tez Asistanı ile serbest danışma ve beyin fırtınası masası."}
                </p>
              </div>
            </div>

            {isGenerating && (
              <span className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse shrink-0">
                <Sparkles className="size-3.5" />
                <span>Yanıt üretiliyor...</span>
              </span>
            )}
          </div>

          {/* Message List Stream Area */}
          <AssistantMessageList
            messages={messages}
            isLoading={isGenerating || isLoadingMessages}
            streamingText={streamingText}
            streamingSources={streamingSources}
            streamingPersona={streamingPersona}
            streamingToolCalls={streamingToolCalls}
            onCitationClick={handleOpenCitation}
            onApproveTool={handleApproveTool}
            onRejectTool={handleRejectTool}
            onUndoTool={handleUndoTool}
          />

          {/* Prompt Input Bar */}
          <AssistantInput
            onSend={handleSendMessage}
            isLoading={isGenerating}
            disabled={isLoadingMessages}
          />
        </div>
      </div>

      {/* RAG Citation Chunk Inspector Dialog */}
      <AssistantCitationDialog
        isOpen={isCitationOpen}
        onClose={handleCloseCitation}
        source={activeCitation}
      />
    </div>
  );
}
