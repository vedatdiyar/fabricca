"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  GraduationCap,
  Send,
  BookOpen,
  Star,
  Loader2,
  Filter,
  X,
  Clock,
  Plus,
  MessageSquare,
  Copy,
  Check,
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
import {
  CitationPopover,
  formatCitationLinks,
} from "./_components/citation-popover";
import { AdvisorSidebar } from "./_components/advisor-sidebar";

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

  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [showFeedbackInput, setShowFeedbackInput] = React.useState(false);
  const [rejectionFeedback, setRejectionFeedback] = React.useState("");

  React.useEffect(() => {
    if (!pendingFunctionCall) {
      setShowFeedbackInput(false);
      setRejectionFeedback("");
    }
  }, [pendingFunctionCall]);

  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

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
              {chatHistory.map((msg, index) => {
                const isAssistant =
                  msg.role === "assistant" || msg.role === "model";
                return (
                  <div
                    key={index}
                    className={`flex gap-4 ${isAssistant ? "justify-start" : "justify-end"} max-w-4xl mx-auto`}
                  >
                    {/* Left Avatar for Assistant */}
                    {isAssistant && (
                      <div className="size-8 rounded-full bg-muted border border-border flex items-center justify-center text-foreground shrink-0 shadow">
                        <GraduationCap className="size-4 text-primary" />
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div className="flex flex-col max-w-[85%] space-y-2">
                      <div
                        className={`p-4 pb-8 pr-10 rounded-xl shadow border transition duration-150 relative ${
                          isAssistant
                            ? "bg-muted border-border rounded-tl-none text-foreground"
                            : "bg-primary border-primary rounded-tr-none text-primary-foreground"
                        }`}
                      >
                        {isAssistant ? (
                          /* Beautiful Cyber-Academic ReactMarkdown Renderer with zero overflow */
                          <div className="prose prose-invert max-w-none text-foreground select-text text-sm">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"p">) => (
                                  <p className="text-sm leading-relaxed text-foreground select-text font-sans mb-3 last:mb-0">
                                    {children}
                                  </p>
                                ),
                                h1: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"h1">) => (
                                  <h2 className="text-lg font-black text-primary mt-8 mb-4 border-b border-border pb-2 select-text font-sans">
                                    {children}
                                  </h2>
                                ),
                                h2: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"h2">) => (
                                  <h3 className="text-base font-extrabold text-primary mt-6 mb-3 border-b border-border pb-1 select-text font-sans">
                                    {children}
                                  </h3>
                                ),
                                h3: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"h3">) => (
                                  <h4 className="text-sm font-bold text-primary mt-4 mb-2 select-text font-sans">
                                    {children}
                                  </h4>
                                ),
                                ul: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"ul">) => (
                                  <ul className="list-disc pl-5 text-sm leading-relaxed text-foreground select-text my-1.5 font-sans space-y-1">
                                    {children}
                                  </ul>
                                ),
                                ol: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"ol">) => (
                                  <ol className="list-decimal pl-5 text-sm leading-relaxed text-foreground select-text my-1.5 font-sans space-y-1">
                                    {children}
                                  </ol>
                                ),
                                li: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"li">) => (
                                  <li className="pl-0.5 my-0.5 text-sm leading-relaxed text-foreground select-text font-sans">
                                    {children}
                                  </li>
                                ),
                                pre: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"pre">) => (
                                  <pre className="bg-background border border-border p-4 rounded-lg my-4 font-mono text-xs overflow-x-auto text-primary">
                                    {children}
                                  </pre>
                                ),
                                code: ({
                                  children,
                                  className,
                                  ...props
                                }: React.ComponentPropsWithoutRef<"code">) => {
                                  const match = /language-(\w+)/.exec(
                                    className || "",
                                  );
                                  return match ? (
                                    <code
                                      className="text-primary font-mono text-xs block"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  ) : (
                                    <code
                                      className="bg-background text-primary px-1.5 py-0.5 rounded font-mono text-xs border border-border select-text"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                },
                                table: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"table">) => (
                                  <div className="overflow-x-auto my-4 border border-border rounded-lg max-w-full">
                                    <table className="w-full text-left border-collapse text-xs select-text">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                thead: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"thead">) => (
                                  <thead className="bg-background text-foreground font-bold border-b border-border">
                                    {children}
                                  </thead>
                                ),
                                tbody: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"tbody">) => (
                                  <tbody>{children}</tbody>
                                ),
                                tr: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"tr">) => (
                                  <tr className="border-b border-border hover:bg-muted/30 transition">
                                    {children}
                                  </tr>
                                ),
                                th: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"th">) => (
                                  <th className="p-3 font-semibold text-primary">
                                    {children}
                                  </th>
                                ),
                                td: ({
                                  children,
                                }: React.ComponentPropsWithoutRef<"td">) => (
                                  <td className="p-3 text-foreground font-medium">
                                    {children}
                                  </td>
                                ),
                                a: ({
                                  href,
                                  children,
                                }: React.ComponentPropsWithoutRef<"a">) => {
                                  if (href && href.startsWith("citation-")) {
                                    const chunkDbId = parseInt(
                                      href.replace("citation-", ""),
                                      10,
                                    );
                                    return (
                                      <CitationPopover
                                        chunkDbId={chunkDbId}
                                        sources={msg.sources}
                                      />
                                    );
                                  }
                                  return (
                                    <a
                                      href={href}
                                      className="text-primary hover:underline font-semibold"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {children}
                                    </a>
                                  );
                                },
                              }}
                            >
                              {formatCitationLinks(msg.content)}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm font-sans font-medium whitespace-pre-wrap select-text leading-relaxed">
                            {msg.content}
                          </p>
                        )}

                        {/* Copy Button */}
                        <button
                          onClick={() => handleCopyMessage(msg.content, index)}
                          className="absolute bottom-2 right-2 p-1.5 rounded bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary transition cursor-pointer"
                          title="Metni Kopyala"
                        >
                          {copiedIndex === index ? (
                            <Check className="size-3.5 text-primary animate-in fade-in zoom-in-95 duration-150" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Footer bar with Timestamp, Citation summary popup triggers & Insight triggers for Assistant */}
                      {isAssistant && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[10px] text-muted-foreground font-sans">
                          <div className="flex items-center gap-1">
                            <Clock className="size-3 text-muted-foreground" />
                            <span>{msg.timestamp}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Save brilliant analysis to AI insights */}
                            <button
                              onClick={() =>
                                handleSaveInsight(msg.content, index)
                              }
                              disabled={savedInsightIds.has(index)}
                              className={`flex items-center gap-1 border px-2 py-0.5 rounded transition cursor-pointer ${
                                savedInsightIds.has(index)
                                  ? "bg-muted border-border text-primary cursor-default"
                                  : "bg-background border-border hover:border-primary hover:text-primary"
                              }`}
                            >
                              <Star
                                className={`size-3 ${savedInsightIds.has(index) ? "fill-primary text-primary" : ""}`}
                              />
                              <span>
                                {savedInsightIds.has(index)
                                  ? "Fikir Sepetinde"
                                  : "Fikir Sepetine Ekle"}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Footer bar for User */}
                      {!isAssistant && (
                        <div className="flex items-center justify-end gap-3 px-1 text-[10px] text-muted-foreground font-sans">
                          <div className="flex items-center gap-1">
                            <Clock className="size-3 text-muted-foreground" />
                            <span>{msg.timestamp}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Danışman Düşünüyor (Loading response state) */}
              {isPending && !pendingFunctionCall && (
                <div className="flex gap-4 justify-start max-w-4xl mx-auto">
                  <div className="size-8 rounded-full bg-muted border border-border flex items-center justify-center text-foreground shrink-0 shadow animate-pulse">
                    <GraduationCap className="size-4 text-primary" />
                  </div>

                  <div className="flex flex-col space-y-1 max-w-[80%]">
                    <div className="bg-muted border border-border p-4 rounded-xl rounded-tl-none flex items-center gap-2">
                      <Loader2 className="size-4 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground font-sans font-medium tracking-wide">
                        Danışman Düşünüyor...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Render the approval card inside scroll flow */}
              {pendingFunctionCall && (
                <div className="max-w-4xl mx-auto my-6 p-5 border border-primary/20 bg-muted/60 rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden select-text">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 shadow">
                      <GraduationCap className="size-5" />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="text-sm font-black text-foreground tracking-tight font-sans">
                          {pendingFunctionCall.name ===
                          "update_thesis_core_framework"
                            ? "📋 Danışman Kararı Doğrultusunda Asistan Taslak Önerisi"
                            : "📋 Danışman Kararı Doğrultusunda Asistan Kutu Taslağı"}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
                          {pendingFunctionCall.name ===
                          "update_thesis_core_framework" ? (
                            <>
                              *Danışmanınızla vardığınız mutabakat
                              doğrultusunda, asistanınız 'Metodoloji & Tarihsel
                              Kapsam' alanı için veritabanı taslağını hazırladı.
                              Onayınız bekleniyor.*
                            </>
                          ) : (
                            <>
                              *Danışmanınızın yönlendirmesi doğrultusunda,
                              asistanınız ilgili tez kutusunun (Bölüm İçeriği:
                              Kutu ID {pendingFunctionCall.args.boxId})
                              içeriğini revize etti. Onayınız bekleniyor.*
                            </>
                          )}
                        </p>
                      </div>

                      {/* Markdown Preview of the proposed update */}
                      <div className="p-4 bg-background border border-border rounded-lg text-sm leading-relaxed text-foreground select-text max-h-72 overflow-y-auto font-sans shadow-inner">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({
                              children,
                            }: React.ComponentPropsWithoutRef<"p">) => (
                              <p className="text-xs leading-relaxed text-foreground mb-2 last:mb-0">
                                {children}
                              </p>
                            ),
                            ul: ({
                              children,
                            }: React.ComponentPropsWithoutRef<"ul">) => (
                              <ul className="list-disc pl-4 text-xs my-1 space-y-1">
                                {children}
                              </ul>
                            ),
                            li: ({
                              children,
                            }: React.ComponentPropsWithoutRef<"li">) => (
                              <li className="text-xs">{children}</li>
                            ),
                          }}
                        >
                          {pendingFunctionCall.name ===
                          "update_thesis_core_framework"
                            ? pendingFunctionCall.args.updatedMethodology || ""
                            : pendingFunctionCall.args.updatedContent || ""}
                        </ReactMarkdown>
                      </div>

                      {/* Action Buttons & Rejection Feedback Flow */}
                      {!showFeedbackInput ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={handleApproveUpdate}
                            disabled={isPending}
                            className="bg-primary hover:bg-primary/95 text-primary-foreground border border-primary px-4 py-2 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isPending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Check className="size-3.5 stroke-[3]" />
                            )}
                            <span className="font-medium">
                              Değişikliği Onayla ve Kutuyu Güncel Tut
                            </span>
                          </button>

                          <button
                            onClick={() => setShowFeedbackInput(true)}
                            disabled={isPending}
                            className="bg-card hover:bg-muted border border-border text-foreground px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm hover:border-muted-foreground/30 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <X className="size-3.5 stroke-[2.5]" />
                            <span className="font-medium">Vazgeç / Reddet</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
                          <label className="text-[11px] text-muted-foreground block font-sans font-semibold">
                            Hocaya neden reddettiğinizi bildirmek ister misiniz?
                            (Öneriyi şekillendirmek için eleştirilerinizi
                            yazabilirsiniz):
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={rejectionFeedback}
                              onChange={(e) =>
                                setRejectionFeedback(e.target.value)
                              }
                              placeholder="Eleştiriniz veya gerekçeniz (boş bırakabilirsiniz)..."
                              disabled={isPending}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleRejectUpdate(rejectionFeedback);
                                }
                              }}
                              className="flex-1 bg-background border border-border rounded-lg text-xs px-3 py-2 text-foreground focus:outline-none focus:border-primary disabled:opacity-50 font-sans"
                            />
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() =>
                                  handleRejectUpdate(rejectionFeedback)
                                }
                                disabled={isPending}
                                className="bg-primary hover:bg-primary/95 text-primary-foreground border border-primary px-4 py-2 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                              >
                                {isPending ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Send className="size-3" />
                                )}
                                <span className="font-medium">
                                  Gerekçeyi Gönder ve Yeni Öneri İste
                                </span>
                              </button>
                              <button
                                onClick={() => {
                                  setShowFeedbackInput(false);
                                  setRejectionFeedback("");
                                }}
                                disabled={isPending}
                                className="bg-card border border-border hover:bg-muted text-foreground px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
                              >
                                Geri
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
