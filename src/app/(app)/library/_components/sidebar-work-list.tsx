"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  BookOpen,
  CircleCheck,
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
import type { LibraryResourceItem, ThesisBoxType } from "../_lib/types";
import {
  getBoxTypeBadgeConfig,
  BOX_TYPE_SHORT_LABELS,
} from "@/lib/box-constants";

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
  resources: LibraryResourceItem[];
  selectedResourceId: number | null;
  onSelectResource: (id: number) => void;
  activeTab: ThesisBoxType;
  onTabChange: (tab: ThesisBoxType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenAddModal?: () => void;
  onDeleteResource?: (resourceId: number) => Promise<void>;
}

/**
 * Sidebar component listing academic literature items with box tabs and search.
 *
 * @param root0 - Component props.
 * @param root0.resources - List of library resources to display.
 * @param root0.selectedResourceId - Id of the currently selected resource.
 * @param root0.onSelectResource - Callback invoked when a resource is selected.
 * @param root0.activeTab - Currently active box tab filter.
 * @param root0.onTabChange - Callback invoked when the active tab changes.
 * @param root0.searchQuery - Current search query text.
 * @param root0.onSearchChange - Callback invoked when the search query changes.
 * @param root0.onOpenAddModal - Optional callback to open the add resource modal.
 * @param root0.onDeleteResource - Optional callback to delete a resource by id.
 * @returns The sidebar work list markup.
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
  const [resourceToDeleteId, setResourceToDeleteId] = useState<number | null>(
    null,
  );

  const handleConfirmDelete = async () => {
    if (resourceToDeleteId !== null && onDeleteResource) {
      await onDeleteResource(resourceToDeleteId);
      setResourceToDeleteId(null);
    }
  };

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
    <Card className="flex h-full w-full flex-col min-h-0 space-y-4 rounded-md p-4">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <BookOpen className="size-3.5 text-primary" />
          <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
            Eserlerim
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAddModal && (
            <button
              type="button"
              onClick={onOpenAddModal}
              title="Yeni Kaynak Ekle"
              className="flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded border border-primary/20 transition-all [&_svg]:size-3.5"
            >
              <Plus className="size-3.5" />
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

      <div className="relative w-full">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Eser veya yazar ara..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 text-sm bg-background border-border"
        />
      </div>

      <div className="grid grid-cols-6 gap-1 rounded-md bg-muted p-1 border border-border/40">
        {BOX_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-full text-center py-1 text-[10px] font-medium rounded transition-all truncate px-1",
                isActive
                  ? "bg-background text-foreground font-semibold border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/20",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

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
                  "group relative cursor-pointer transition-all border p-3 hover:border-primary/20",
                  isSelected
                    ? "bg-accent/20 border-primary/20"
                    : "bg-background border-border hover:bg-accent/20",
                )}
              >
                <CardContent className="p-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-sans text-sm font-semibold text-foreground line-clamp-2 leading-snug flex-1 min-w-0">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      {hasPdf && (
                        <span
                          title="Tam metin PDF mevcut"
                          className="flex items-center gap-1 text-[10px] text-success font-semibold bg-success/10 px-2 py-1 rounded border border-success/20"
                        >
                          <FileText className="h-2.5 w-2.5" />
                          <span>PDF</span>
                        </span>
                      )}
                      {item.isRead ? (
                        <span
                          title="Okundu"
                          className="flex items-center text-primary"
                        >
                          <CircleCheck className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span
                          title="Okunacak"
                          className="flex items-center text-muted-foreground/40"
                        >
                          <Circle className="h-3.5 w-3.5" />
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
                          className="opacity-0 group-hover:opacity-100 flex items-center p-1 text-muted-foreground hover:text-destructive transition-all rounded hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        badgeConfig.dotClassName,
                      )}
                    />
                    <span className="text-[10px] font-medium text-muted-foreground truncate">
                      {badgeConfig.label}
                      {item.subBoxTitle ? ` • ${item.subBoxTitle}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                    <span className="truncate max-w-45 font-normal text-muted-foreground">
                      {item.authors.join(", ")}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.publicationYear ?? ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog
        open={resourceToDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setResourceToDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eseri Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription>
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
    </Card>
  );
}
