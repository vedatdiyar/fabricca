"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  BookOpen,
  CheckCircle2,
  Circle,
  Layers,
  Plus,
  Trash2,
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

/**
 * UI Badge configuration helper for thesis box types.
 */
export function getBoxTypeBadgeConfig(boxType: Exclude<ThesisBoxType, "ALL">) {
  switch (boxType) {
    case "THEORETICAL_FRAMEWORK":
      return {
        label: "Kuramsal Çerçeve",
        className: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      };
    case "METHODOLOGY":
      return {
        label: "Metodoloji",
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      };
    case "SUBJECT_PROBLEM":
      return {
        label: "Konu - Problem",
        className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      };
    case "PRIMARY_MATERIAL":
      return {
        label: "Birincil Malzeme",
        className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      };
    default:
      return {
        label: "Genel",
        className: "bg-muted text-muted-foreground border-border",
      };
  }
}

/**
 * Tab configuration list for thesis box filtering.
 */
const BOX_TABS: { id: ThesisBoxType; label: string }[] = [
  { id: "ALL", label: "Tümü" },
  { id: "SUBJECT_PROBLEM", label: "Problem" },
  { id: "THEORETICAL_FRAMEWORK", label: "Teori" },
  { id: "PRIMARY_MATERIAL", label: "Birincil" },
  { id: "METHODOLOGY", label: "Yöntem" },
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

  // Filter resources based on active tab and search query
  const filteredResources = resources.filter((item) => {
    const matchesTab = activeTab === "ALL" || item.boxType === activeTab;
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.authors.some((author) =>
        author.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    return matchesTab && matchesSearch;
  });

  // Scroll the selected resource card into view whenever selection or filtered list changes
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current || selectedResourceId === null) return;
    const selectedEl = scrollRef.current.querySelector(
      `[data-resource-id="${selectedResourceId}"]`,
    );
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "start", behavior: "smooth" });
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
                  ? "bg-background text-foreground shadow-sm font-semibold border border-border/60"
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

            return (
              <Card
                key={item.id}
                data-resource-id={item.id}
                onClick={() => onSelectResource(item.id)}
                className={cn(
                  "cursor-pointer transition-all border p-3 hover:border-primary/40",
                  isSelected
                    ? "bg-accent border-primary/60 shadow-sm"
                    : "bg-background border-border hover:bg-accent/40",
                )}
              >
                <CardContent className="p-0 space-y-2">
                  {/* Top Row: Box Badge + Read Status */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 border font-medium",
                        badgeConfig.className,
                      )}
                    >
                      {badgeConfig.label}
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {onDeleteResource && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResourceToDeleteId(item.id);
                          }}
                          title="Eseri Sil"
                          className="flex items-center gap-1 px-1 py-0.5 text-muted-foreground/50 hover:text-destructive transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                      {item.isRead ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Okundu
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Circle className="h-3 w-3" /> Okunacak
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-sans text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                    {item.title}
                  </h3>

                  {/* Authors & Year */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <span className="truncate max-w-[180px]">
                      {item.authors.join(", ")}
                    </span>
                    <span className="font-mono text-[10px]">
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
