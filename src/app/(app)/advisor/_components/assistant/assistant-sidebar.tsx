"use client";

import { useState } from "react";
import { Plus, Search, MessageSquare, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ChatSessionListItem } from "../../session-actions";
import { cn } from "@/lib/utils";

interface AssistantSidebarProps {
  sessions: ChatSessionListItem[];
  activeSessionId: number | null;
  isLoading: boolean;
  onSelectSession: (sessionId: number) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: number) => Promise<void>;
}

/**
 * Left sidebar listing active thesis assistant topic sessions with search,
 * create, and delete actions.
 * Formatted to be 1:1 consistent with the draft-review past sessions sidebar.
 *
 * @param props - Component props.
 * @param props.sessions - Array of chat sessions.
 * @param props.activeSessionId - The currently selected session ID.
 * @param props.isLoading - Whether sessions are loading.
 * @param props.onSelectSession - Callback to switch session.
 * @param props.onNewSession - Callback to create a new session.
 * @param props.onDeleteSession - Callback to delete a session.
 * @returns The rendered sidebar markup.
 */
export function AssistantSidebar({
  sessions,
  activeSessionId,
  isLoading,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: AssistantSidebarProps) {
  const [search, setSearch] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<ChatSessionListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteSession(sessionToDelete.id);
      setSessionToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="flex h-full w-full flex-col min-h-0 space-y-4 rounded-lg p-5 bg-card border-border shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
            Konu Oturumları
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onNewSession}
            className="h-7 text-xs px-2.5 bg-primary text-primary-foreground hover:bg-primary/90 gap-1 cursor-pointer rounded-md shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Yeni Sohbet</span>
          </Button>
          <Badge
            variant="outline"
            className="text-xs font-medium text-muted-foreground border-border"
          >
            {sessions.length}
          </Badge>
        </div>
      </div>

      {/* Search input */}
      <div className="relative w-full shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Oturumlarda ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 pr-7 text-xs h-8 bg-background border-border rounded-md"
        />
        {search && (
          <button
            type="button"
            aria-label="Aramayı temizle"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Sessions List / Centered Empty State */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <span>Oturumlar yükleniyor...</span>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-5 text-center text-muted-foreground rounded-lg border border-dashed border-border/60 bg-background/40">
            <MessageSquare className="size-8 opacity-30 text-muted-foreground mb-2" />
            <h3 className="font-serif text-sm font-semibold text-foreground">
              {search ? "Arama Sonucu Bulunamadı" : "Henüz Oturum Yok"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-[220px]">
              {search
                ? "Farklı bir arama terimi deneyebilirsiniz."
                : "Yeni Sohbet butonu ile ilk oturumunuzu başlatın."}
            </p>
          </div>
        ) : (
          filteredSessions.map((item) => {
            const isActive = item.id === activeSessionId;
            return (
              <Card
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectSession(item.id);
                  }
                }}
                className={cn(
                  "group relative cursor-pointer transition-all border p-3 rounded-md shrink-0",
                  isActive
                    ? "bg-accent/20 border-primary/20"
                    : "bg-background border-border hover:bg-accent/10 hover:border-primary/20",
                )}
              >
                <CardContent className="p-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <MessageSquare className="size-3.5 text-primary shrink-0" />
                      <h3 className="font-serif text-sm font-semibold text-foreground truncate">
                        {item.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      aria-label="Oturumu Sil"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDelete(item);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 rounded transition-opacity cursor-pointer shrink-0 text-muted-foreground"
                      title="Oturumu Sil"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-xs text-muted-foreground">
                    <span>{item.createdAt}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3 text-primary" />
                      <span>{item.messageCount} mesaj</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={sessionToDelete !== null}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
      >
        <AlertDialogContent className="max-w-md p-5 rounded-lg border-border bg-card">
          <AlertDialogHeader className="space-y-1.5">
            <AlertDialogTitle className="font-serif text-base font-semibold tracking-tight text-foreground">
              Oturumu Sil
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              &quot;{sessionToDelete?.title}&quot; başlıklı oturumu ve tüm mesaj
              geçmişini kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem
              geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2 gap-2">
            <AlertDialogCancel
              disabled={isDeleting}
              className="h-8 text-xs px-3 rounded-md border-border bg-background hover:bg-muted text-foreground"
            >
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="h-8 text-xs px-3 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {isDeleting && <Loader2 className="size-3.5 animate-spin" />}
              <span>Sil</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
