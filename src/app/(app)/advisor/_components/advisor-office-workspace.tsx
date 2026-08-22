"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, ArrowLeft, Layers, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { OfficeSubmissionForm } from "./office-submission-form";
import { OfficeMarginNotes } from "./office-margin-notes";
import { OfficeDefenseChat, type DefenseMessage } from "./office-defense-chat";
import { OfficeActionToolbar } from "./office-action-toolbar";
import { OfficeSessionSidebar } from "./office-session-sidebar";
import {
  getOfficeInitialDataAction,
  getOfficeSessionDetailAction,
  type OutlineOption,
  type OfficeSessionSummary,
} from "../office-actions";
import type {
  OfficeReviewReport,
  JuryCritique,
} from "../_services/pipeline/types";
import { Skeleton } from "@/components/ui/skeleton";

interface AdvisorOfficeWorkspaceProps {
  initialSessionId?: number;
}

/**
 * Root workspace for Danışmanın Çalışma Odası (Office Hours & Draft Audit Desk).
 * Seamlessly fits into the standard Fabricca page layout with full responsive flow.
 */
export function AdvisorOfficeWorkspace({
  initialSessionId,
}: AdvisorOfficeWorkspaceProps) {
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [outlines, setOutlines] = useState<OutlineOption[]>([]);
  const [sessions, setSessions] = useState<OfficeSessionSummary[]>([]);

  // Active Session & Review State
  const [activeSessionId, setActiveSessionId] = useState<number | null>(
    initialSessionId || null,
  );
  const [currentReport, setCurrentReport] = useState<OfficeReviewReport | null>(
    null,
  );
  const [activeOutlineId, setActiveOutlineId] = useState<number | null>(null);
  const [activeOutlineTitle, setActiveOutlineTitle] = useState<string>("");

  // Defense Chat State
  const [defenseMessages, setDefenseMessages] = useState<DefenseMessage[]>([]);
  const [hasStartedDefense, setHasStartedDefense] = useState(false);
  const [isStreamingDefense, setIsStreamingDefense] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [activeCritique, setActiveCritique] = useState<JuryCritique | null>(
    null,
  );
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<
    "margin-notes" | "defense-chat"
  >("margin-notes");
  const [mobileSubmissionTab, setMobileSubmissionTab] = useState<
    "form" | "history"
  >("form");

  // Load session detail callback
  const loadSessionDetail = useCallback(
    async (sessionId: number, outlineList: OutlineOption[] = outlines) => {
      try {
        const res = await getOfficeSessionDetailAction(sessionId);
        if (res.success && res.data) {
          const detail = res.data;
          setActiveSessionId(detail.id);
          setCurrentReport(detail.reviewReport);
          setActiveOutlineId(detail.outlineId);
          setMobileSubmissionTab("form");

          const outlineMatch = outlineList.find(
            (o) => o.id === detail.outlineId,
          );
          setActiveOutlineTitle(
            detail.outlineTitle || outlineMatch?.title || "Tez Bölümü",
          );

          // Filter messages for defense chat
          const chatMsgs: DefenseMessage[] = detail.messages
            .filter(
              (m) =>
                m.role === "user" ||
                (m.role === "assistant" && !m.pipelineData),
            )
            .map((m) => ({
              id: m.id,
              role: m.role as "assistant" | "user",
              content: m.content,
              createdAt: m.createdAt,
            }));

          setDefenseMessages(chatMsgs);
          setHasStartedDefense(chatMsgs.length > 0);
        } else {
          toast.error(res.error || "Oturum detayları yüklenemedi.");
        }
      } catch {
        toast.error("Oturum yüklenirken bir hata oluştu.");
      }
    },
    [outlines],
  );

  // Load initial data on mount
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const res = await getOfficeInitialDataAction();
        if (!isMounted) return;
        if (res.success) {
          setOutlines(res.outlines);
          setSessions(res.sessions);

          if (initialSessionId) {
            await loadSessionDetail(initialSessionId, res.outlines);
          }
        } else {
          toast.error(res.error || "Başlangıç verileri yüklenemedi.");
        }
      } catch {
        if (isMounted) {
          toast.error("Danışman masası yüklenirken bir hata oluştu.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingInitial(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [initialSessionId, loadSessionDetail]);

  // 1. Submit Draft for 3-part Review (Phase 1 -> Phase 2)
  const handleReviewSubmit = async (data: {
    outlineId: number;
    draftText: string;
    studentNote?: string;
  }) => {
    setIsSubmittingReview(true);
    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REVIEW",
          outlineId: data.outlineId,
          draftText: data.draftText,
          studentNote: data.studentNote,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Taslak denetimi başarısız oldu.");
      }

      const outlineMatch = outlines.find((o) => o.id === data.outlineId);
      setActiveOutlineId(data.outlineId);
      setActiveOutlineTitle(outlineMatch?.title || "Tez Bölümü");
      setActiveSessionId(json.sessionId);
      setCurrentReport(json.reviewReport);
      setDefenseMessages([]);
      setHasStartedDefense(false);
      setMobileWorkspaceTab("margin-notes");

      // Refresh session sidebar
      const initialRes = await getOfficeInitialDataAction();
      if (initialRes.success) {
        setSessions(initialRes.sessions);
      }

      toast.success(
        "Taslak incelendi. Kenar notları ve jüri eleştirileri hazır!",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Taslak incelenirken hata oluştu.",
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // 2. Start Live Defense & Stream SSE
  const handleStartDefense = async (critique?: JuryCritique) => {
    if (!activeSessionId) return;
    if (critique) {
      setActiveCritique(critique);
    }
    setHasStartedDefense(true);
    setMobileWorkspaceTab("defense-chat");

    const userPrompt = critique
      ? `Hocam, "${critique.title}" eleştirisine dair şu noktayı açıklamak ve savunmak istiyorum: ${critique.suggestedDefensePoint || critique.critique}`
      : undefined;

    await handleSendDefenseMessage(userPrompt);
  };

  // 3. Send message in live defense and stream response
  const handleSendDefenseMessage = async (userMessage?: string) => {
    if (!activeSessionId || isStreamingDefense) return;

    if (userMessage) {
      const userMsgItem: DefenseMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessage,
        createdAt: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setDefenseMessages((prev) => [...prev, userMsgItem]);
    }

    setIsStreamingDefense(true);

    const tempAdvisorId = `advisor-${Date.now()}`;
    const streamingMsgItem: DefenseMessage = {
      id: tempAdvisorId,
      role: "assistant",
      content: "",
      isStreaming: true,
      createdAt: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setDefenseMessages((prev) => [...prev, streamingMsgItem]);

    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DEFENSE",
          sessionId: activeSessionId,
          userMessage,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Danışman yanıtı alınamadı.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        const lines = rawChunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === "chunk" && parsed.text) {
                accumulatedText += parsed.text;
                setDefenseMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempAdvisorId
                      ? { ...m, content: accumulatedText }
                      : m,
                  ),
                );
              }
            } catch {
              // Ignore non-json lines
            }
          }
        }
      }

      setDefenseMessages((prev) =>
        prev.map((m) =>
          m.id === tempAdvisorId
            ? { ...m, content: accumulatedText, isStreaming: false }
            : m,
        ),
      );
    } catch {
      toast.error("Danışman yanıt verirken bir hata oluştu.");
      setDefenseMessages((prev) => prev.filter((m) => m.id !== tempAdvisorId));
    } finally {
      setIsStreamingDefense(false);
    }
  };

  // Reset to submission form
  const handleResetToNewSubmission = () => {
    setActiveSessionId(null);
    setCurrentReport(null);
    setActiveOutlineId(null);
    setActiveOutlineTitle("");
    setDefenseMessages([]);
    setHasStartedDefense(false);
    setMobileWorkspaceTab("margin-notes");
    setMobileSubmissionTab("form");
  };

  if (isLoadingInitial) {
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

  const isReviewActive = activeSessionId !== null && currentReport !== null;

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
              Danışmanın Çalışma Odası
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-primary/10 text-primary border-primary/20"
            >
              {isReviewActive ? "İnceleme & Savunma Masası" : "Ofis Randevusu"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Word taslak pasajlarınızı teslim edin, sayfa denetimi ve editoryal
            rötuşları inceleyin, danışmanla canlı müzakere edin.
          </p>
        </div>

        {isReviewActive && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetToNewSubmission}
            className="text-xs h-9 gap-1.5 border-border bg-background hover:bg-muted text-foreground shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Yeni Taslak Teslimi</span>
          </Button>
        )}
      </div>

      {/* Main Workspace Flow */}
      {isReviewActive ? (
        // PHASE 2: Split Workspace (Margin Notes + Live Defense Chat + Actions Toolbar)
        <div className="flex flex-col gap-3">
          {/* Active Section Context Bar */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border text-xs">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">
                {activeOutlineTitle}
              </span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
              <Clock className="h-3.5 w-3.5" />
              <span>Danışman Ofis Masası</span>
            </div>
          </div>

          {/* Mobile Phase 2 Tab Switcher (Visible below lg) */}
          <div className="flex items-center rounded-lg border border-border bg-card p-1 text-xs lg:hidden">
            <button
              type="button"
              onClick={() => setMobileWorkspaceTab("margin-notes")}
              className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all ${
                mobileWorkspaceTab === "margin-notes"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Kenar Notları & Denetim
            </button>
            <button
              type="button"
              onClick={() => setMobileWorkspaceTab("defense-chat")}
              className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all ${
                mobileWorkspaceTab === "defense-chat"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Canlı Savunma Masası{" "}
              {defenseMessages.length > 0 ? `(${defenseMessages.length})` : ""}
            </button>
          </div>

          {/* Unified Split Workspace Card */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden flex flex-col lg:flex-row h-[660px]">
            {/* Left Panel: Margin Notes & Audit */}
            <div
              className={`w-full lg:w-1/2 h-full border-b lg:border-b-0 lg:border-r border-border overflow-hidden ${
                mobileWorkspaceTab === "margin-notes"
                  ? "block"
                  : "hidden lg:block"
              }`}
            >
              <OfficeMarginNotes
                report={currentReport}
                hasStartedDefense={hasStartedDefense}
                onStartDefense={handleStartDefense}
              />
            </div>

            {/* Right Panel: Live Defense Chat */}
            <div
              className={`w-full lg:w-1/2 h-full overflow-hidden ${
                mobileWorkspaceTab === "defense-chat"
                  ? "block"
                  : "hidden lg:block"
              }`}
            >
              <OfficeDefenseChat
                messages={defenseMessages}
                isStreaming={isStreamingDefense}
                onSendMessage={(text) => handleSendDefenseMessage(text)}
                hasStartedDefense={hasStartedDefense}
                onStartDefense={handleStartDefense}
                activeCritique={activeCritique}
              />
            </div>
          </div>

          {/* Footer Action Toolbar */}
          <OfficeActionToolbar
            outlineId={activeOutlineId || 0}
            outlineTitle={activeOutlineTitle || "Tez Bölümü"}
            report={currentReport}
            defenseMessages={defenseMessages}
            onResetToNewSubmission={handleResetToNewSubmission}
          />
        </div>
      ) : (
        // PHASE 1: Submission View (Past Sessions Sidebar + Submission Form + Guide Cards)
        <div className="flex flex-col gap-4">
          {/* Mobile Phase 1 Tab Switcher when sessions exist */}
          {sessions.length > 0 && (
            <div className="flex items-center rounded-lg border border-border bg-card p-1 text-xs lg:hidden">
              <button
                type="button"
                onClick={() => setMobileSubmissionTab("form")}
                className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all ${
                  mobileSubmissionTab === "form"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yeni Taslak Teslimi
              </button>
              <button
                type="button"
                onClick={() => setMobileSubmissionTab("history")}
                className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all ${
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
            {/* Left Column: Past Sessions */}
            <div
              className={`lg:col-span-4 w-full ${
                mobileSubmissionTab === "history" ? "block" : "hidden lg:block"
              }`}
            >
              <OfficeSessionSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={(id) => loadSessionDetail(id, outlines)}
                onNewSession={handleResetToNewSubmission}
                onSessionDeleted={(deletedId) => {
                  setSessions((prev) => prev.filter((s) => s.id !== deletedId));
                  if (activeSessionId === deletedId) {
                    handleResetToNewSubmission();
                  }
                }}
              />
            </div>

            {/* Right Column: Submission Form & Guide Cards */}
            <div
              className={`lg:col-span-8 w-full ${
                mobileSubmissionTab === "form" ? "block" : "hidden lg:block"
              }`}
            >
              <OfficeSubmissionForm
                outlines={outlines}
                isSubmitting={isSubmittingReview}
                onSubmit={handleReviewSubmit}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
