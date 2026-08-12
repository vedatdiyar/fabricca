"use client";

import React, { useState } from "react";
import { Search, MessageSquare, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
import type { ChatSessionListItem } from "../actions";

interface ChatSidebarProps {
  sessions: ChatSessionListItem[];
  activeSessionId: number | null;
  onSelectSession: (id: number) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: number) => Promise<void>;
}

/**
 * Sidebar listing past advisor chat sessions with search, create, and delete actions.
 *
 * @param root0 - Component props.
 * @param root0.sessions - List of chat session items.
 * @param root0.activeSessionId - Id of the currently active session.
 * @param root0.onSelectSession - Callback when a session is selected.
 * @param root0.onCreateSession - Callback to create a new session.
 * @param root0.onDeleteSession - Callback to delete a session.
 * @returns The chat sidebar markup.
 */
export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionToDeleteId, setSessionToDeleteId] = useState<number | null>(
    null,
  );

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleConfirmDelete = async () => {
    if (sessionToDeleteId !== null) {
      await onDeleteSession(sessionToDeleteId);
      setSessionToDeleteId(null);
    }
  };

  return (
    <Card className="flex h-full w-full flex-col min-h-0 space-y-4 rounded-md p-4">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground whitespace-nowrap">
            Geçmiş Sohbetler
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateSession}
            title="Yeni Sohbet Başlat"
            className="flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded border border-primary/20 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Yeni</span>
          </button>
          <Badge
            variant="outline"
            className="text-xs font-medium text-muted-foreground border-border"
          >
            {filteredSessions.length}
          </Badge>
        </div>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Sohbet ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 text-sm bg-background border-border"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground p-4">
            <MessageSquare className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
            <p className="text-sm font-medium">Kayıtlı sohbet bulunamadı</p>
            <p className="text-xs text-muted-foreground mt-1">
              Yeni bir sohbet başlatarak başlayabilirsiniz.
            </p>
          </div>
        ) : (
          filteredSessions.map((item) => {
            const isSelected = item.id === activeSessionId;

            return (
              <Card
                key={item.id}
                onClick={() => onSelectSession(item.id)}
                className={cn(
                  "group relative cursor-pointer transition-all border p-3",
                  isSelected
                    ? "bg-primary/10 border-primary/20 text-foreground font-semibold"
                    : "bg-card border-border/40 hover:bg-accent/20 text-muted-foreground hover:border-primary/20",
                )}
              >
                <CardContent className="p-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-lg font-medium tracking-tight text-foreground line-clamp-2 leading-snug flex-1 min-w-0">
                      {item.title}
                    </h3>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDeleteId(item.id);
                      }}
                      title="Sohbeti Sil"
                      className="opacity-0 group-hover:opacity-100 flex items-center p-1 text-muted-foreground hover:text-destructive transition-all cursor-pointer rounded hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                    <span className="font-normal text-muted-foreground">
                      {item.messageCount} mesaj
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.createdAt}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog
        open={sessionToDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setSessionToDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold text-foreground">
              Sohbeti Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Bu sohbet ve tüm mesajları kalıcı olarak silinecektir. Bu işlem
              geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-medium">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium"
            >
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
