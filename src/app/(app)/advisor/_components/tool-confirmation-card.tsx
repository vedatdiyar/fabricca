"use client";

import { useState } from "react";
import { Check, X, Database, Loader2, Sparkles, RotateCcw, ArrowRight } from "lucide-react";
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

interface ComparisonRow {
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  isWarning?: boolean;
}

/**
 * Maps function tool call parameters and optional previous state into a structured list of Old vs New state rows.
 */
function getComparisonRows(toolCall: PendingToolCall): ComparisonRow[] {
  const { name, args, previousState } = toolCall;
  const rows: ComparisonRow[] = [];

  const translateBoxType = (type?: unknown) => {
    switch (type) {
      case "SUBJECT_PROBLEM":
        return "Konu ve Problem";
      case "THEORETICAL_FRAMEWORK":
        return "Kuramsal Çerçeve";
      case "PRIMARY_MATERIAL":
        return "Birincil Materyal";
      case "METHODOLOGY":
        return "Yöntem";
      case "RELATED_THESES":
        return "İlgili Tezler";
      default:
        return String(type || "—");
    }
  };

  const translateTaskStatus = (status?: unknown) => {
    switch (status) {
      case "TODO":
        return "Yapılacak";
      case "IN_PROGRESS":
        return "Devam Ediyor";
      case "DONE":
        return "Tamamlandı";
      default:
        return String(status || "—");
    }
  };

  switch (name) {
    case "createBox": {
      rows.push({
        fieldLabel: "Kutu Başlığı",
        oldValue: "(Yok - Yeni Öğe)",
        newValue: (args.title as string) || "—",
      });
      if (args.boxType) {
        rows.push({
          fieldLabel: "Kutu Kategorisi",
          oldValue: "—",
          newValue: translateBoxType(args.boxType),
        });
      }
      if (args.description) {
        rows.push({
          fieldLabel: "Açıklama",
          oldValue: "—",
          newValue: (args.description as string),
        });
      }
      break;
    }

    case "updateBox": {
      rows.push({
        fieldLabel: "Kutu ID",
        oldValue: `#${args.boxId}`,
        newValue: `#${args.boxId}`,
      });
      if (args.title !== undefined) {
        rows.push({
          fieldLabel: "Kutu Başlığı",
          oldValue:
            (previousState?.title as string) || "(Değiştirilmedi / Mevcut Başlık)",
          newValue: (args.title as string) || "—",
        });
      }
      if (args.description !== undefined) {
        rows.push({
          fieldLabel: "Kutu Açıklaması",
          oldValue:
            (previousState?.description as string) ||
            "(Henüz Açıklama Eklenmemiş / Boş)",
          newValue: (args.description as string) || "—",
        });
      }
      break;
    }

    case "deleteBox": {
      rows.push({
        fieldLabel: `Kutu #${args.boxId}`,
        oldValue: (previousState?.title as string) || `Kutu #${args.boxId}`,
        newValue: "Veritabanından Kalıcı Olarak Silinecek ⚠️",
        isWarning: true,
      });
      break;
    }

    case "updateThesisMatrix": {
      if (args.subjectProblem !== undefined) {
        rows.push({
          fieldLabel: "Konu ve Problem",
          oldValue:
            (previousState?.subjectProblem as string) || "(Henüz Girilmemiş / Boş)",
          newValue: (args.subjectProblem as string) || "(Temizlenecek)",
        });
      }
      if (args.theoreticalFramework !== undefined) {
        rows.push({
          fieldLabel: "Kuramsal Çerçeve",
          oldValue:
            (previousState?.theoreticalFramework as string) ||
            "(Henüz Girilmemiş / Boş)",
          newValue: (args.theoreticalFramework as string) || "(Temizlenecek)",
        });
      }
      if (args.primaryMaterial !== undefined) {
        rows.push({
          fieldLabel: "Birincil Materyal",
          oldValue:
            (previousState?.primaryMaterial as string) ||
            "(Henüz Girilmemiş / Boş)",
          newValue: (args.primaryMaterial as string) || "(Temizlenecek)",
        });
      }
      if (args.methodology !== undefined) {
        rows.push({
          fieldLabel: "Yöntem & Metodoloji",
          oldValue:
            (previousState?.methodology as string) || "(Henüz Girilmemiş / Boş)",
          newValue: (args.methodology as string) || "(Temizlenecek)",
        });
      }
      break;
    }

    case "createTask": {
      rows.push({
        fieldLabel: "Görev Başlığı",
        oldValue: "(Yok - Yeni Görev)",
        newValue: (args.title as string) || "—",
      });
      if (args.status) {
        rows.push({
          fieldLabel: "Kanban Durumu",
          oldValue: "—",
          newValue: translateTaskStatus(args.status),
        });
      }
      break;
    }

    case "updateTaskStatus": {
      rows.push({
        fieldLabel: `Görev #${args.taskId}`,
        oldValue: translateTaskStatus(previousState?.status) || "Mevcut Durum",
        newValue: translateTaskStatus(args.status),
      });
      break;
    }

    case "addNote": {
      rows.push({
        fieldLabel: "Kaynak ID & Sayfa",
        oldValue: "—",
        newValue: `Kaynak #${args.sourceId} ${args.pageNumber ? `(s. ${args.pageNumber})` : ""}`,
      });
      if (args.content) {
        rows.push({
          fieldLabel: "Not / Alıntı İçeriği",
          oldValue: "(Yok - Yeni Not)",
          newValue: (args.content as string),
        });
      }
      break;
    }

    case "deleteSource": {
      rows.push({
        fieldLabel: `Kaynak #${args.sourceId}`,
        oldValue: (previousState?.title as string) || `Kaynak #${args.sourceId}`,
        newValue: "Kütüphaneden Silinecek ⚠️",
        isWarning: true,
      });
      break;
    }

    case "deleteNote": {
      rows.push({
        fieldLabel: `Not #${args.noteId}`,
        oldValue: (previousState?.content as string) || `Not #${args.noteId}`,
        newValue: "Not Silinecek ⚠️",
        isWarning: true,
      });
      break;
    }

    default: {
      for (const [key, value] of Object.entries(args)) {
        rows.push({
          fieldLabel: key,
          oldValue: String(previousState?.[key] ?? "Mevcut Değer"),
          newValue:
            typeof value === "object" ? JSON.stringify(value) : String(value),
        });
      }
    }
  }

  return rows;
}

/**
 * Returns a Turkish human-readable category badge label for a tool name.
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
 * Interactive full-width card component that displays an AI database mutation request
 * with a detailed Old State vs New State comparison table, allowing explicit Approval/Rejection.
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
  const comparisonRows = getComparisonRows(toolCall);

  return (
    <div className="my-3 w-full rounded-2xl border border-primary/25 bg-card/80 p-5 shadow-md backdrop-blur-md space-y-4 transition-all">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
            <Database className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold tracking-wide uppercase text-foreground">
              {categoryLabel}
            </h4>
            <p className="text-[11px] text-muted-foreground font-medium">
              Veritabanı Değişikliği Ön İzlemesi
            </p>
          </div>
        </div>

        {toolCall.status === "pending" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Onay Bekliyor
          </span>
        )}
        {toolCall.status === "approved" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
            Uygulandı
          </span>
        )}
        {toolCall.status === "undone" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <RotateCcw className="size-3.5" />
            Geri Alındı
          </span>
        )}
        {toolCall.status === "rejected" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            <X className="size-3.5" />
            İptal Edildi
          </span>
        )}
      </div>

      {/* Explanation Text */}
      <p className="text-sm leading-relaxed text-foreground font-medium">
        {toolCall.explanation}
      </p>

      {/* Full-width Old State vs New State Comparison Table */}
      {comparisonRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-background/60 shadow-inner">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs table-fixed">
              <thead className="bg-muted/80 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-4 font-semibold w-[20%]">
                    Alan / Nesne
                  </th>
                  <th className="py-2.5 px-4 font-semibold w-[40%] text-muted-foreground/80">
                    Eski Durum (Mevcut)
                  </th>
                  <th className="py-2.5 px-4 font-semibold w-[40%] text-primary">
                    <div className="flex items-center gap-1">
                      <span>Yeni Durum (Önerilen)</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-foreground align-top break-words">
                      {row.fieldLabel}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] leading-relaxed break-words align-top bg-muted/20">
                      {row.oldValue}
                    </td>
                    <td
                      className={`py-3 px-4 font-mono text-[11px] leading-relaxed break-words align-top ${
                        row.isWarning
                          ? "text-destructive font-bold bg-destructive/10"
                          : "text-foreground font-semibold bg-primary/5"
                      }`}
                    >
                      {row.newValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions Footer */}
      {toolCall.status === "pending" && (
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(toolCall.toolCallId)}
            disabled={isExecuting}
            className="h-9 px-4 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border-border/80"
          >
            <X className="size-3.5" />
            İptal Et
          </Button>
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isExecuting}
            className="h-9 px-5 gap-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
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
        </div>
      )}

      {toolCall.status === "approved" && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="size-4 shrink-0" />
            <span>Veritabanı değişikliği uygulandı.</span>
          </div>
          {onUndo && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndo}
              disabled={isUndoing}
              className="h-8 px-3 gap-1.5 text-xs font-semibold border-amber-500/40 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
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
        <div className="flex items-center gap-1.5 pt-2 text-xs font-semibold text-amber-600 dark:text-amber-400 border-t border-border/40">
          <RotateCcw className="size-4 shrink-0" />
          <span>İşlem kullanıcı tarafından geri alındı.</span>
        </div>
      )}

      {toolCall.status === "rejected" && (
        <div className="flex items-center gap-1.5 pt-2 text-xs font-semibold text-muted-foreground border-t border-border/40">
          <X className="size-4 shrink-0" />
          <span>İşlem kullanıcı tarafından iptal edildi.</span>
        </div>
      )}
    </div>
  );
}

