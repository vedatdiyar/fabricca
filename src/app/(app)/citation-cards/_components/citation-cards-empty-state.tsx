"use client";

import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CitationCardsEmptyStateProps {
  onClearFilters: () => void;
  onAddNew: () => void;
}

/**
 * Empty-state panel shown when no citation cards match the active filters.
 *
 * @param root0 - Component props.
 * @param root0.onClearFilters - Callback invoked to reset all filters.
 * @param root0.onAddNew - Callback invoked to open the add-card dialog.
 * @returns The empty state markup.
 */
export function CitationCardsEmptyState({
  onClearFilters,
  onAddNew,
}: CitationCardsEmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center p-12 rounded-md border border-dashed border-border/40 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
      <h3 className="font-serif text-base font-semibold text-foreground">
        Kriterlere Uygun Alıntı Fişi Bulunamadı
      </h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
        Arama kelimenizi veya seçili kutu/not türü filtrelerinizi değiştirerek
        tekrar deneyin.
      </p>
      <div className="flex items-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="text-xs"
        >
          Filtreleri Temizle
        </Button>
        <Button size="sm" onClick={onAddNew} className="text-xs gap-1">
          <Plus className="h-3.5 w-3.5" />
          Yeni Fiş Ekle
        </Button>
      </div>
    </Card>
  );
}
