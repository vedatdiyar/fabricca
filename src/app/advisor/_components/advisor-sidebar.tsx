"use client";

import React from "react";
import {
  Plus,
  Trash2,
  MessageSquare,
  Info,
  ArrowRight,
  Loader2,
  Check,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReferenceItem } from "../_services/db-actions";
import { ChatSession } from "../_hooks/use-advisor";

interface ChatListProps {
  sessions: ChatSession[];
  currentSessionId: string;
  executeClearAllChatHistory: () => void;
  handleSwitchSession: (sessionId: string) => void;
  executeDeleteSession: (sessionId: string) => void;
  handleCreateNewSession: () => void;
  isMobile?: boolean;
}

function ChatList({
  sessions,
  currentSessionId,
  executeClearAllChatHistory,
  handleSwitchSession,
  executeDeleteSession,
  handleCreateNewSession,
  isMobile = false,
}: ChatListProps) {
  return (
    <div className={`flex flex-col flex-1 min-h-0 ${isMobile ? "pt-4" : ""}`}>
      <div className="flex items-center justify-between mb-3 shrink-0">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
          Geçmiş Sohbetler
        </span>
        {sessions.length > 1 && (
          <AlertDialog>
            <AlertDialogTrigger className="text-[9px] text-muted-foreground hover:text-destructive font-bold transition flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 shadow-none">
              <Trash2 className="size-2.5" />
              Tümünü Sil
            </AlertDialogTrigger>
            <AlertDialogContent className="border border-border bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-sans text-foreground">
                  Tüm Sohbet Geçmişini Temizle
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  TÜM sohbet geçmişinizi kalıcı olarak silmek istediğinize emin
                  misiniz? Bu işlem geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border text-foreground hover:bg-muted cursor-pointer">
                  İptal
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={executeClearAllChatHistory}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
                >
                  Evet, Tümünü Sil
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Scrollable list of chat sessions */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
        {sessions.map((sess) => {
          const isActive = sess.id === currentSessionId;
          return (
            <div
              key={sess.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSwitchSession(sess.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSwitchSession(sess.id);
                }
              }}
              className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition duration-100 ${
                isActive
                  ? "bg-muted border-primary"
                  : "bg-background border-border hover:border-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <MessageSquare
                  className={`size-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                />
                <div className="flex-1 min-w-0">
                  <h4
                    className={`text-xs font-bold truncate ${isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
                  >
                    {sess.title}
                  </h4>
                  <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                    {sess.createdAt ? sess.createdAt.split(",")[0] : ""}
                  </p>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger
                  onClick={(e) => e.stopPropagation()}
                  className={`hover:text-destructive p-1 rounded transition shrink-0 ml-1.5 cursor-pointer bg-transparent border-0 ${
                    isMobile
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                  title="Sohbeti Sil"
                >
                  <Trash2 className="size-3" />
                </AlertDialogTrigger>
                <AlertDialogContent
                  className="border border-border bg-card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-sans text-foreground">
                      Sohbeti Sil
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs text-muted-foreground">
                      {sessions.length === 1
                        ? "Bu son sohbet. Sohbet geçmişini tamamen temizlemek istediğinize emin misiniz?"
                        : "Bu sohbet geçmişini tamamen silmek istediğinize emin misiniz?"}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border text-foreground hover:bg-muted cursor-pointer">
                      İptal
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => executeDeleteSession(sess.id)}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
                    >
                      Evet, Sil
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        })}
      </div>

      {!isMobile && (
        <div className="border-t border-border pt-3 mt-auto shrink-0">
          <button
            onClick={handleCreateNewSession}
            className="w-full flex items-center justify-center gap-2 bg-background hover:bg-muted border border-border hover:border-primary py-2 rounded-lg text-xs font-bold text-foreground hover:text-primary transition duration-100 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Yeni Sohbet Başlat</span>
          </button>
        </div>
      )}

      {isMobile && (
        <button
          onClick={handleCreateNewSession}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground border border-primary py-2.5 rounded-lg text-xs font-bold transition shadow-md shrink-0"
        >
          <Plus className="size-3.5" />
          <span>Yeni Sohbet Başlat</span>
        </button>
      )}
    </div>
  );
}

interface SourceListProps {
  loadingRefs: boolean;
  references: ReferenceItem[];
  selectedRefIds: number[];
  handleSelectAllRefs: () => void;
  handleClearAllRefs: () => void;
  handleToggleRef: (id: number) => void;
  isMobile?: boolean;
}

function SourceList({
  loadingRefs,
  references,
  selectedRefIds,
  handleSelectAllRefs,
  handleClearAllRefs,
  handleToggleRef,
  isMobile = false,
}: SourceListProps) {
  if (loadingRefs) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2">
        <Loader2 className="size-6 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-sans">
          {isMobile ? "Yükleniyor..." : "Referanslar yükleniyor..."}
        </p>
      </div>
    );
  }

  if (references.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border rounded-lg bg-background">
        <Info className="size-6 text-muted-foreground mb-2" />
        <h3 className="text-xs font-bold text-foreground">
          {isMobile ? "Kütüphane Boş" : "Kütüphaneniz Boş"}
        </h3>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          {isMobile
            ? "RAG araması için PDF yüklemeniz gerekmektedir."
            : "RAG araması yapmak için öncelikle Kütüphane sayfasından araştırma makalelerinizi (PDF) yükleyin."}
        </p>
        <a
          href="/library"
          className="mt-4 flex items-center gap-1 bg-muted hover:bg-accent border border-border px-3 py-1.5 rounded text-[10px] font-bold text-foreground transition"
        >
          Kütüphaneye Git
          <ArrowRight className="size-3 text-primary" />
        </a>
      </div>
    );
  }

  return (
    <div className={`flex flex-col flex-1 min-h-0 ${isMobile ? "pt-4" : ""}`}>
      <div className="flex gap-2 mb-3 shrink-0">
        <button
          onClick={handleSelectAllRefs}
          className="flex-1 bg-muted hover:bg-accent border border-border py-1.5 rounded text-[9px] font-bold text-foreground transition cursor-pointer"
        >
          Tümünü Seç
        </button>
        <button
          onClick={handleClearAllRefs}
          className="flex-1 bg-muted hover:bg-accent border border-border py-1.5 rounded text-[9px] font-bold text-foreground transition cursor-pointer"
        >
          Seçimi Kaldır
        </button>
      </div>

      {/* Scrollable list of references */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
        {references.map((ref) => {
          const isChecked = selectedRefIds.includes(ref.id);
          return (
            <div
              key={ref.id}
              role="button"
              tabIndex={0}
              onClick={() => handleToggleRef(ref.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggleRef(ref.id);
                }
              }}
              className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition duration-100 ${
                isChecked
                  ? "bg-muted border-primary"
                  : "bg-background border-border hover:border-muted-foreground"
              }`}
            >
              {isMobile ? (
                <div
                  className={`mt-0.5 size-4 rounded border flex items-center justify-center shrink-0 transition ${
                    isChecked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                >
                  {isChecked && <Check className="size-3 stroke-[3]" />}
                </div>
              ) : (
                <Checkbox
                  checked={isChecked}
                  className="mt-0.5 pointer-events-none"
                />
              )}

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate">
                  {ref.title}
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {ref.authors || "Bilinmeyen Yazar"}
                  {ref.year ? ` • ${ref.year}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {!isMobile && (
        <div className="border-t border-border pt-3 mt-auto shrink-0">
          <p className="text-[10px] text-muted-foreground leading-normal font-sans">
            Soru sorduğunuzda semantik RAG taraması{" "}
            <strong>yalnızca seçili</strong> makaleler üzerinde çalışır. Hiçbiri
            seçilmezse genel asistan modu aktifleşir.
          </p>
        </div>
      )}
    </div>
  );
}

interface AdvisorSidebarProps {
  isMobile?: boolean;
  references: ReferenceItem[];
  selectedRefIds: number[];
  sessions: ChatSession[];
  currentSessionId: string;
  activeSidebarTab: "chats" | "sources";
  setActiveSidebarTab: (tab: "chats" | "sources") => void;
  loadingRefs: boolean;
  handleToggleRef: (id: number) => void;
  handleSelectAllRefs: () => void;
  handleClearAllRefs: () => void;
  handleSwitchSession: (sessionId: string) => void;
  handleCreateNewSession: () => void;
  executeDeleteSession: (sessionId: string) => void;
  executeClearAllChatHistory: () => void;
}

export function AdvisorSidebar({
  isMobile = false,
  references,
  selectedRefIds,
  sessions,
  currentSessionId,
  activeSidebarTab,
  setActiveSidebarTab,
  loadingRefs,
  handleToggleRef,
  handleSelectAllRefs,
  handleClearAllRefs,
  handleSwitchSession,
  handleCreateNewSession,
  executeDeleteSession,
  executeClearAllChatHistory,
}: AdvisorSidebarProps) {
  if (isMobile) {
    return (
      <>
        {activeSidebarTab === "chats" ? (
          <ChatList
            sessions={sessions}
            currentSessionId={currentSessionId}
            executeClearAllChatHistory={executeClearAllChatHistory}
            handleSwitchSession={handleSwitchSession}
            executeDeleteSession={executeDeleteSession}
            handleCreateNewSession={handleCreateNewSession}
            isMobile={true}
          />
        ) : (
          <SourceList
            loadingRefs={loadingRefs}
            references={references}
            selectedRefIds={selectedRefIds}
            handleSelectAllRefs={handleSelectAllRefs}
            handleClearAllRefs={handleClearAllRefs}
            handleToggleRef={handleToggleRef}
            isMobile={true}
          />
        )}
      </>
    );
  }

  return (
    <Tabs
      value={activeSidebarTab}
      onValueChange={(v) => setActiveSidebarTab(v as "chats" | "sources")}
      className="flex-1 flex flex-col min-h-0"
    >
      <TabsList className="w-full bg-background border border-border p-1 rounded-lg grid grid-cols-2 mb-4 shrink-0">
        <TabsTrigger
          value="chats"
          className="data-[state=active]:bg-muted data-[state=active]:text-primary text-[10px] font-black uppercase tracking-wider cursor-pointer"
        >
          Sohbetlerim ({sessions.length})
        </TabsTrigger>
        <TabsTrigger
          value="sources"
          className="data-[state=active]:bg-muted data-[state=active]:text-primary text-[10px] font-black uppercase tracking-wider cursor-pointer"
        >
          Kaynaklar ({references.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="chats"
        className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden"
      >
        <ChatList
          sessions={sessions}
          currentSessionId={currentSessionId}
          executeClearAllChatHistory={executeClearAllChatHistory}
          handleSwitchSession={handleSwitchSession}
          executeDeleteSession={executeDeleteSession}
          handleCreateNewSession={handleCreateNewSession}
          isMobile={false}
        />
      </TabsContent>

      <TabsContent
        value="sources"
        className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden"
      >
        <SourceList
          loadingRefs={loadingRefs}
          references={references}
          selectedRefIds={selectedRefIds}
          handleSelectAllRefs={handleSelectAllRefs}
          handleClearAllRefs={handleClearAllRefs}
          handleToggleRef={handleToggleRef}
          isMobile={false}
        />
      </TabsContent>
    </Tabs>
  );
}
