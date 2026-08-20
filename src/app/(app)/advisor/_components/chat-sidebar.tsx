"use client";

import React, { useState } from "react";
import { Search, MessageSquare, Trash2, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <Card className="flex h-full w-full flex-col min-h-0 rounded-md p-4 space-y-3.5 border-border">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-sm font-semibold tracking-tight text-foreground truncate">
              Geçmiş Sohbetler
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              Danışman oturum geçmişi
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className="text-[10px] font-mono font-semibold text-muted-foreground border-border h-6 px-1.5 shrink-0"
        >
          {sessions.length}
        </Badge>
      </div>

      {/* New Chat Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCreateSession}
        title="Yeni Sohbet Başlat"
        className="w-full h-8 text-xs font-medium gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 transition-all cursor-pointer shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Yeni Sohbet Başlat</span>
      </Button>

      {/* Search Input */}
      <div className="relative w-full shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Sohbet ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-8 text-xs h-8 bg-background border-border rounded-md"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Aramayı temizle"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Scrollable Session List */}
      <ScrollArea className="flex-1 min-h-0 pr-1.5 -mr-1.5">
        <div className="space-y-2 min-w-0 pr-1 pb-1">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground p-4">
              <div className="h-10 w-10 rounded-full bg-muted/50 border border-border/40 flex items-center justify-center mb-3 text-muted-foreground">
                <MessageSquare className="h-5 w-5 opacity-40" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Kayıtlı sohbet bulunamadı
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {searchQuery
                  ? "Aramanıza uygun sohbet bulunamadı."
                  : "Yeni bir sohbet başlatabilirsiniz."}
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
                    "group relative cursor-pointer transition-all border p-3 rounded-md",
                    isSelected
                      ? "bg-primary/10 border-primary/20 text-foreground"
                      : "bg-card border-border/40 hover:bg-accent/20 text-muted-foreground hover:border-primary/20",
                  )}
                >
                  <CardContent className="p-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <MessageSquare
                          className={cn(
                            "h-3.5 w-3.5 mt-0.5 shrink-0 transition-colors",
                            isSelected
                              ? "text-primary"
                              : "text-muted-foreground/60 group-hover:text-muted-foreground",
                          )}
                        />
                        <h3
                          className={cn(
                            "font-sans text-xs font-semibold leading-snug line-clamp-2 min-w-0",
                            isSelected
                              ? "text-foreground font-semibold"
                              : "text-foreground/90 group-hover:text-foreground",
                          )}
                        >
                          {item.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDeleteId(item.id);
                        }}
                        title="Sohbeti Sil"
                        className="opacity-0 group-hover:opacity-100 flex items-center p-1 text-muted-foreground hover:text-destructive transition-all cursor-pointer rounded hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/40 font-mono">
                      <span className="font-normal text-muted-foreground">
                        {item.messageCount} mesaj
                      </span>
                      <span className="text-muted-foreground">
                        {item.createdAt}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Modal */}
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
