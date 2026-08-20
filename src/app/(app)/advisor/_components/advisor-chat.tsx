"use client";

import { ChatSidebar } from "./chat-sidebar";
import { ChatMessageList } from "./chat-message-list";
import { AdvisorChatInput } from "./advisor-chat-input";
import { AdvisorCitationDialog } from "./advisor-citation-dialog";
import { useAdvisorChat } from "./use-advisor-chat";
import type { AdvisorChatProps } from "../_lib/types";

/**
 * Interactive Advisor Chat component delivering an academic AI conversation backed by Hybrid RAG & Cohere Rerank with persistent chat history sidebar and Function Calling database tools.
 *
 * @param root0 - Component props.
 * @param root0.initialSessionId - The session id to restore on mount, if any.
 * @returns The AdvisorChat UI element.
 */
export function AdvisorChat({ initialSessionId }: AdvisorChatProps) {
  const {
    messages,
    isLoading,
    isLocked,
    activeCitation,
    setActiveCitation,
    sessions,
    activeSessionId,
    streamingText,
    streamingSources,
    streamingToolCalls,
    streamingPersona,
    streamingPipeline,
    copiedMessageId,
    setCopiedMessageId,
    activeSource,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handleApproveToolCall,
    handleUndoToolCall,
    handleRejectToolCall,
    handleApprovePipeline,
    handleSend,
    handleCitationPosition,
  } = useAdvisorChat(initialSessionId);

  const handleCopyMessage = (messageId: string, content: string) => {
    void navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 1500);
  };

  return (
    <div className="w-full flex gap-6 min-h-0 h-[calc(100vh-8.5rem)]">
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col min-h-0 w-80 shrink-0 h-full">
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Chat Window */}
        <ChatMessageList
          messages={messages}
          isLoading={isLoading}
          streamingText={streamingText}
          streamingSources={streamingSources}
          streamingToolCalls={streamingToolCalls}
          streamingPersona={streamingPersona}
          streamingPipeline={streamingPipeline}
          activeSessionId={activeSessionId}
          copiedMessageId={copiedMessageId}
          onCopyMessage={handleCopyMessage}
          onCitationPosition={handleCitationPosition}
          onApproveToolCall={handleApproveToolCall}
          onRejectToolCall={handleRejectToolCall}
          onUndoToolCall={handleUndoToolCall}
          onApprovePipeline={handleApprovePipeline}
        />

        {/* Input Box */}
        <AdvisorChatInput
          onSend={handleSend}
          disabled={isLoading}
          isLocked={isLocked}
        />
      </div>

      {/* Citation Dialog */}
      <AdvisorCitationDialog
        isOpen={activeCitation !== null}
        onClose={() => setActiveCitation(null)}
        source={activeSource}
      />
    </div>
  );
}
