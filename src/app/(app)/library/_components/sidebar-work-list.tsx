"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  BookOpen,
  CheckCircle2,
  Circle,
  Layers,
  Plus,
  Trash2,
  FileText,
} from "lucide-react";
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
import type { LibraryResourceItem, ThesisBoxType } from "../_types/types";
import {
  getBoxTypeBadgeConfig,
  BOX_TYPE_SHORT_LABELS,
} from "@/lib/box-constants";

/**
 * Tab configuration list for thesis box filtering.
 */
const BOX_TABS: { id: ThesisBoxType; label: string }[] = [
  { id: "ALL", label: "Tümü" },
  { id: "SUBJECT_PROBLEM", label: BOX_TYPE_SHORT_LABELS.SUBJECT_PROBLEM },
  {
    id: "THEORETICAL_FRAMEWORK",
    label: BOX_TYPE_SHORT_LABELS.THEORETICAL_FRAMEWORK,
  },
  { id: "METHODOLOGY", label: BOX_TYPE_SHORT_LABELS.METHODOLOGY },
  { id: "PRIMARY_MATERIAL", label: BOX_TYPE_SHORT_LABELS.PRIMARY_MATERIAL },
];

interface SidebarWorkListProps {
  /** Array of library resources to render */
  resources: LibraryResourceItem[];
  /** Currently selected resource ID */
  selectedResourceId: number | null;
  /** Callback fired when a resource item is selected */
  onSelectResource: (id: number) => void;
  /** Active box tab filter state */
  activeTab: ThesisBoxType;
  /** Callback to change active box tab filter */
  onTabChange: (tab: ThesisBoxType) => void;
  /** Search query state string */
  searchQuery: string;
  /** Callback to update search query */
  onSearchChange: (query: string) => void;
  /** Callback to open the add new resource modal */
  onOpenAddModal?: () => void;
  /** Callback to permanently delete a resource with its PDF and all related data */
  onDeleteResource?: (resourceId: number) => Promise<void>;
}

/**
 * Sidebar component listing academic literature items with box tabs and search.
 */
export function SidebarWorkList({
  resources,
  selectedResourceId,
  onSelectResource,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onOpenAddModal,
  onDeleteResource,
}: SidebarWorkListProps) {
  // Deletion confirmation modal state
  const [resourceToDeleteId, setResourceToDeleteId] = useState<number | null>(
    null,
  );

  /**
   * Confirms and deletes the selected resource.
   */
  const handleConfirmDelete = async () => {
    if (resourceToDeleteId !== null && onDeleteResource) {
      await onDeleteResource(resourceToDeleteId);
      setResourceToDeleteId(null);
    }
  };

  // Filter resources based on active tab and search query (memoized so the
  // scroll effect below only re-runs when the visible list actually changes)
  const filteredResources = useMemo(
    () =>
      resources.filter((item) => {
        const matchesTab = activeTab === "ALL" || item.boxType === activeTab;
        const matchesSearch =
          searchQuery.trim() === "" ||
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.authors.some((author) =>
            author.toLowerCase().includes(searchQuery.toLowerCase()),
          );
        return matchesTab && matchesSearch;
      }),
    [resources, activeTab, searchQuery],
  );

  // Scroll the selected resource card into view whenever selection or filtered list changes.
  // Scoped strictly to the sidebar list container so the page window never scrolls.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current || selectedResourceId === null) return;
    const container = scrollRef.current;
    const selectedEl = container.querySelector(
      `[data-resource-id="${selectedResourceId}"]`,
    );
    if (selectedEl) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = selectedEl.getBoundingClientRect();
      const top = targetRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({ top, behavior: "smooth" });
    }
  }, [selectedResourceId, filteredResources]);

  return (
    <div className="flex h-full w-full flex-col min-h-0 space-y-4 rounded-md border border-border bg-card p-4">
      {/* Header Title & Add Resource Action */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Eserlerim
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAddModal && (
            <button
              type="button"
              onClick={onOpenAddModal}
              title="Yeni Kaynak Ekle"
              className="flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded border border-primary/20 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Yeni Ekle</span>
            </button>
          )}
          <Badge
            variant="outline"
            className="text-xs font-medium text-muted-foreground border-border"
          >
            {filteredResources.length}
          </Badge>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Eser veya yazar ara..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 text-sm bg-background border-border"
        />
      </div>

      {/* Box Filter Tabs */}
      <div className="grid grid-cols-5 gap-1 rounded-md bg-muted p-1 border border-border/40">
        {BOX_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-full text-center px-1 py-1 text-xs font-medium rounded-md transition-all cursor-pointer truncate",
                isActive
                  ? "bg-background text-foreground font-semibold border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Work Cards List Container */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1"
      >
        {filteredResources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground p-4">
            <Layers className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
            <p className="text-sm font-medium">Kayıtlı eser bulunamadı</p>
            <p className="text-xs text-muted-foreground mt-1">
              Filtreyi temizlemeyi veya yeni literatür eklemeyi
              deneyebilirsiniz.
            </p>
          </div>
        ) : (
          filteredResources.map((item) => {
            const isSelected = item.id === selectedResourceId;
            const badgeConfig = getBoxTypeBadgeConfig(item.boxType);
            const hasPdf = item.pdfStatus === "READY" || Boolean(item.pdfUrl);

            return (
              <Card
                key={item.id}
                data-resource-id={item.id}
                onClick={() => onSelectResource(item.id)}
                className={cn(
                  "group relative cursor-pointer transition-all border p-3 hover:border-primary/40",
                  isSelected
                    ? "bg-accent/80 border-primary/60"
                    : "bg-background border-border hover:bg-accent/30",
                )}
              >
                <CardContent className="p-0 space-y-2">
                  {/* Top Row: Title + Indicators & Delete (hover only) */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-sans text-sm font-semibold text-foreground line-clamp-2 leading-snug flex-1 min-w-0">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      {hasPdf && (
                        <span
                          title="Tam metin PDF mevcut"
                          className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20"
                        >
                          <FileText className="h-2.5 w-2.5" />
                          <span>PDF</span>
                        </span>
                      )}
                      {item.isRead ? (
                        <span
                          title="Okundu"
                          className="flex items-center text-emerald-600 dark:text-emerald-400"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span
                          title="Okunacak"
                          className="flex items-center text-amber-600 dark:text-amber-400"
                        >
                          <Circle className="h-3.5 w-3.5 opacity-60" />
                        </span>
                      )}
                      {onDeleteResource && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResourceToDeleteId(item.id);
                          }}
                          title="Eseri Sil"
                          className="opacity-0 group-hover:opacity-100 flex items-center p-0.5 text-muted-foreground hover:text-destructive transition-all cursor-pointer rounded hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sleek Dot Indicator + Category Text */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        badgeConfig.dotClassName,
                      )}
                    />
                    <span className="text-[11px] font-medium text-muted-foreground truncate">
                      {badgeConfig.label}
                      {item.subBoxTitle ? ` • ${item.subBoxTitle}` : ""}
                    </span>
                  </div>

                  {/* Authors & Year */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1.5 border-t border-border/40">
                    <span className="truncate max-w-[180px] font-normal text-muted-foreground">
                      {item.authors.join(", ")}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.publicationYear}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Delete Resource Confirmation Dialog */}
      <AlertDialog
        open={resourceToDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setResourceToDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold text-foreground">
              Eseri Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Bu akademik eser, PDF dosyası, vektör verileri ve tüm notlarınızla
              birlikte kalıcı olarak silinecektir. Bu işlem geri alınamaz.
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
    </div>
  );
}
