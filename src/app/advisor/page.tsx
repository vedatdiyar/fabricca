"use client";

import React from "react";
import dynamic from "next/dynamic";
import {
  Send,
  BookOpen,
  Loader2,
  Filter,
  X,
  Plus,
  MessageSquare,
} from "lucide-react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";

import { useAdvisor } from "./_hooks/use-advisor";
import { AdvisorSidebar } from "./_components/advisor-sidebar";
import { ApprovalCard } from "./_components/approval-card";

// ChatMessages uses react-markdown + remark-gfm (heavy) — load on demand
const ChatMessages = dynamic(
  () => import("./_components/chat-messages").then((mod) => mod.ChatMessages),
  { ssr: false },
);

export default function AdvisorPage() {
  const {
    references,
    selectedRefIds,
    chatHistory,
    inputValue,
    setInputValue,
    isPending,
    loadingRefs,
    sessions,
    currentSessionId,
    activeSidebarTab,
    setActiveSidebarTab,
    savedInsightIds,
    messagesEndRef,
    textareaRef,
    pendingFunctionCall,
    handleToggleRef,
    handleSelectAllRefs,
    handleClearAllRefs,
    handleSwitchSession,
    handleCreateNewSession,
    executeDeleteSession,
    executeClearAllChatHistory,
    handleSendMessage,
    handleKeyDown,
    handleSaveInsight,
    handleApproveUpdate,
    handleRejectUpdate,
  } = useAdvisor();

  return (
    <Drawer>
      <div className="flex flex-1 flex-col bg-background text-foreground p-4 md:p-8 h-screen overflow-hidden relative">
        {/* Header Area */}
        <header className="border-b border-border pb-4 mb-6 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight font-sans text-foreground">
              Dijital Danışman Odası
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              NotebookLM kalitesinde, dipnot atıflı RAG asistan motoru ve
              akademik chat paneli
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile Drawer Trigger */}
            <DrawerTrigger className="md:hidden flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-accent hover:border-accent-foreground transition cursor-pointer">
              <Filter className="size-3.5 text-primary" />
              <span>Panel ({selectedRefIds.length})</span>
            </DrawerTrigger>

            {/* New Chat Button */}
            <button
              onClick={handleCreateNewSession}
              title="Yeni Sohbet Başlat"
              className="bg-primary hover:bg-primary/95 text-primary-foreground border border-primary px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="size-3.5 stroke-[3]" />
              <span>Yeni Sohbet</span>
            </button>

            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-sans font-bold uppercase tracking-wider text-primary bg-card border border-border px-3 py-1 rounded">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              RAG ACTIVE
            </span>
          </div>
        </header>

        {/* Workspace Area */}
        <div className="flex-1 flex gap-6 overflow-hidden min-h-0 mb-4">
          {/* LEFT SIDEBAR: Tab-controlled Multi-session Chat History & Discussion Reference Library */}
          <aside className="hidden md:flex flex-col w-72 bg-card border border-border rounded-xl p-5 shadow-lg overflow-hidden shrink-0">
            <AdvisorSidebar
              isMobile={false}
              references={references}
              selectedRefIds={selectedRefIds}
              sessions={sessions}
              currentSessionId={currentSessionId}
              activeSidebarTab={activeSidebarTab}
              setActiveSidebarTab={setActiveSidebarTab}
              loadingRefs={loadingRefs}
              handleToggleRef={handleToggleRef}
              handleSelectAllRefs={handleSelectAllRefs}
              handleClearAllRefs={handleClearAllRefs}
              handleSwitchSession={handleSwitchSession}
              handleCreateNewSession={handleCreateNewSession}
              executeDeleteSession={executeDeleteSession}
              executeClearAllChatHistory={executeClearAllChatHistory}
            />
          </aside>

          {/* RIGHT CHAT AREA: Academic RAG Chat */}
          <main className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-lg overflow-hidden relative">
            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
              <ChatMessages
                chatHistory={chatHistory}
                isPending={isPending}
                pendingFunctionCall={pendingFunctionCall}
                savedInsightIds={savedInsightIds}
                messagesEndRef={messagesEndRef}
                handleSaveInsight={handleSaveInsight}
              />

              {/* Render the approval card inside scroll flow */}
              <ApprovalCard
                pendingFunctionCall={pendingFunctionCall}
                isPending={isPending}
                handleApproveUpdate={handleApproveUpdate}
                handleRejectUpdate={handleRejectUpdate}
              />

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Textarea Box Container */}
            <div className="border-t border-border p-4 bg-card shrink-0 select-none">
              <div className="max-w-4xl mx-auto flex items-end bg-background border border-border rounded-lg p-1.5 focus-within:border-primary transition duration-150">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={
                    isPending
                      ? "Danışman yanıtı hazırlıyor..."
                      : selectedRefIds.length > 0
                        ? `Seçili ${selectedRefIds.length} makale üzerinde arayarak tez danışmanına sorun...`
                        : "Kuramsal teoriler veya nitel/nicel araştırma yöntemleri üzerine tartışma başlatın..."
                  }
                  disabled={isPending}
                  aria-label="Dijital danışman mesaj kutusu"
                  className="flex-1 bg-transparent text-sm text-foreground focus:outline-none px-3 py-1 disabled:text-muted-foreground disabled:cursor-not-allowed resize-none max-h-40 overflow-y-auto leading-relaxed font-sans"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isPending}
                  className="bg-primary hover:bg-primary/95 text-primary-foreground border border-primary px-4 py-2 rounded-md text-xs font-extrabold flex items-center gap-2 transition duration-100 disabled:opacity-40 disabled:cursor-not-allowed h-9 self-end cursor-pointer"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span>Gönder</span>
                </button>
              </div>
            </div>
          </main>
        </div>

        {/* MOBILE DRAWER: Handles both Chat Sessions and References seamlessly */}
        <DrawerContent className="md:hidden">
          <DrawerHeader className="flex justify-between items-center border-b border-border pb-3 shrink-0">
            <DrawerTitle className="text-sm font-bold flex items-center gap-2 font-sans">
              {activeSidebarTab === "chats" ? (
                <>
                  <MessageSquare className="size-4 text-primary" />
                  Sohbetlerim
                </>
              ) : (
                <>
                  <BookOpen className="size-4 text-primary" />
                  Kaynaklarım
                </>
              )}
            </DrawerTitle>
            <div className="flex bg-muted border border-border p-0.5 rounded-lg mr-8">
              <button
                onClick={() => setActiveSidebarTab("chats")}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                  activeSidebarTab === "chats"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sohbetler
              </button>
              <button
                onClick={() => setActiveSidebarTab("sources")}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                  activeSidebarTab === "sources"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Kaynaklar ({references.length})
              </button>
            </div>
            <DrawerClose className="hover:text-destructive transition cursor-pointer">
              <X className="size-4" />
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 flex flex-col px-5 pb-5 overflow-hidden max-h-[70vh]">
            <AdvisorSidebar
              isMobile={true}
              references={references}
              selectedRefIds={selectedRefIds}
              sessions={sessions}
              currentSessionId={currentSessionId}
              activeSidebarTab={activeSidebarTab}
              setActiveSidebarTab={setActiveSidebarTab}
              loadingRefs={loadingRefs}
              handleToggleRef={handleToggleRef}
              handleSelectAllRefs={handleSelectAllRefs}
              handleClearAllRefs={handleClearAllRefs}
              handleSwitchSession={handleSwitchSession}
              handleCreateNewSession={handleCreateNewSession}
              executeDeleteSession={executeDeleteSession}
              executeClearAllChatHistory={executeClearAllChatHistory}
            />
          </div>
        </DrawerContent>
      </div>
    </Drawer>
  );
}
