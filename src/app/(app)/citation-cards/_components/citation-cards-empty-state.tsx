"use client";

import { BookOpen, Plus, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CitationCardsEmptyStateProps {
  onClearFilters: () => void;
  onAddNew: () => void;
  hasFilters?: boolean;
}

/**
 * Empty-state panel shown when no citation cards match the active filters or when no cards exist.
 *
 * @param props - Component props.
 * @returns The empty state markup.
 */
export function CitationCardsEmptyState({
  onClearFilters,
  onAddNew,
  hasFilters = true,
}: CitationCardsEmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center p-12 rounded-md border border-dashed border-border/80 text-center bg-card/50">
      <div className="h-12 w-12 rounded-full bg-muted/60 border border-border flex items-center justify-center text-muted-foreground mb-4">
        {hasFilters ? (
          <FilterX className="h-6 w-6 text-muted-foreground opacity-80" />
        ) : (
          <BookOpen className="h-6 w-6 text-primary opacity-80" />
        )}
      </div>
      <h3 className="font-serif text-base font-semibold text-foreground">
        {hasFilters
          ? "Kriterlere Uygun Alıntı Fişi Bulunamadı"
          : "Henüz Alıntı Fişi Oluşturulmadı"}
      </h3>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">
        {hasFilters
          ? "Arama kelimenizi, konu kutusunu veya not türü filtrelerinizi değiştirerek tekrar deneyebilirsiniz."
          : "Akademik kaynaklarınızdan derlediğiniz doğrudan alıntıları, dolaylı açımlamaları ve kişisel tez notlarınızı fişleyin."}
      </p>
      <div className="flex items-center gap-2.5 mt-5">
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="text-xs h-8"
          >
            Filtreleri Temizle
          </Button>
        )}
        <Button size="sm" onClick={onAddNew} className="text-xs h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Yeni Fiş Ekle
        </Button>
      </div>
    </Card>
  );
}
