"use client";

import { BookOpen, Plus, FilterX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

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
    <EmptyState
      icon={hasFilters ? FilterX : BookOpen}
      title={
        hasFilters
          ? "Kriterlere Uygun Alıntı Fişi Bulunamadı"
          : "Henüz Alıntı Fişi Oluşturulmadı"
      }
      description={
        hasFilters
          ? "Arama kelimenizi, konu kutusunu veya not türü filtrelerinizi değiştirerek tekrar deneyebilirsiniz."
          : "Akademik kaynaklarınızdan derlediğiniz doğrudan alıntıları, dolaylı açımlamaları ve kişisel tez notlarınızı fişleyin."
      }
      variant="dashedMuted"
      actions={
        hasFilters
          ? [
              {
                label: "Filtreleri Temizle",
                onClick: onClearFilters,
                variant: "outline",
              },
              { label: "Yeni Fiş Ekle", onClick: onAddNew, icon: Plus },
            ]
          : [{ label: "Yeni Fiş Ekle", onClick: onAddNew, icon: Plus }]
      }
    />
  );
}
