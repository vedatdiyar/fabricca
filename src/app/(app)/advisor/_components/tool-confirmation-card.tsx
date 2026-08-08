"use client";

import { useState } from "react";
import { Check, X, Database, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PendingToolCall {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  explanation: string;
  status: "pending" | "approved" | "rejected" | "undone";
  executionResult?: unknown;
  previousState?: Record<string, unknown>;
}

interface ToolConfirmationCardProps {
  toolCall: PendingToolCall;
  onApprove: (
    toolCallId: string,
    name: string,
    args: Record<string, unknown>,
  ) => Promise<void>;
  onReject: (toolCallId: string) => void;
  onUndo?: (
    toolCallId: string,
    name: string,
    args: Record<string, unknown>,
    executionResult?: unknown,
    previousState?: Record<string, unknown>,
  ) => Promise<void>;
}

/**
 * Returns a Turkish human-readable category badge label for a tool name.
 *
 * @param name - The tool function name.
 * @returns The Turkish category label.
 */
function getToolCategoryLabel(name: string): string {
  switch (name) {
    case "updateThesisMatrix":
      return "Tez Matrisi Güncellemesi";
    case "createBox":
    case "updateBox":
    case "deleteBox":
      return "Kutu Yönetim İşlemi";
    case "updateSource":
    case "deleteSource":
      return "Kütüphane Kaynak İşlemi";
    case "addNote":
    case "deleteNote":
      return "Not ve Alıntı İşlemi";
    case "createTask":
    case "updateTaskStatus":
      return "Kanban Görev İşlemi";
    default:
      return "Veritabanı Değişiklik İsteği";
  }
}

/**
 * Interactive card component that displays an AI database mutation request
 * and allows the user to explicitly Approve, Reject, or Undo the action.
 *
 * @param props - Component props.
 * @param props.toolCall - Pending tool call data object.
 * @param props.onApprove - Async handler invoked when user approves the action.
 * @param props.onReject - Handler invoked when user rejects the action.
 * @param props.onUndo - Async handler invoked when user undoes an approved action.
 * @returns The tool confirmation card UI element.
 */
export function ToolConfirmationCard({
  toolCall,
  onApprove,
  onReject,
  onUndo,
}: ToolConfirmationCardProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const handleApprove = async () => {
    setIsExecuting(true);
    try {
      await onApprove(toolCall.toolCallId, toolCall.name, toolCall.args);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUndo = async () => {
    if (!onUndo) return;
    setIsUndoing(true);
    try {
      await onUndo(
        toolCall.toolCallId,
        toolCall.name,
        toolCall.args,
        toolCall.executionResult,
        toolCall.previousState,
      );
    } finally {
      setIsUndoing(false);
    }
  };

  const categoryLabel = getToolCategoryLabel(toolCall.name);

  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-card/60 p-4 shadow-sm backdrop-blur-sm space-y-3 transition-all">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-primary shrink-0" />
          <span className="text-xs font-semibold tracking-wide text-foreground">
            {categoryLabel}
          </span>
        </div>
        {toolCall.status === "pending" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Sparkles className="size-3" />
            Onay Bekliyor
          </span>
        )}
        {toolCall.status === "approved" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-3" />
            Uygulandı
          </span>
        )}
        {toolCall.status === "undone" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            <RotateCcw className="size-3" />
            Geri Alındı
          </span>
        )}
        {toolCall.status === "rejected" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <X className="size-3" />
            İptal Edildi
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-foreground/90 font-medium">
        {toolCall.explanation}
      </p>

      {toolCall.status === "pending" && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isExecuting}
            className="h-8 gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isExecuting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                İşleniyor...
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                Onayla ve Uygula
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(toolCall.toolCallId)}
            disabled={isExecuting}
            className="h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            İptal Et
          </Button>
        </div>
      )}

      {toolCall.status === "approved" && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="size-4 shrink-0" />
            <span>İşlem başarıyla gerçekleştirildi.</span>
          </div>
          {onUndo && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndo}
              disabled={isUndoing}
              className="h-7 gap-1.5 text-xs font-medium border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              {isUndoing ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Geri Alınıyor...
                </>
              ) : (
                <>
                  <RotateCcw className="size-3" />
                  İşlemi Geri Al
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {toolCall.status === "undone" && (
        <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <RotateCcw className="size-4 shrink-0" />
          <span>İşlem kullanıcı tarafından geri alındı.</span>
        </div>
      )}

      {toolCall.status === "rejected" && (
        <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-muted-foreground">
          <X className="size-4 shrink-0" />
          <span>İşlem kullanıcı tarafından iptal edildi.</span>
        </div>
      )}
    </div>
  );
}
