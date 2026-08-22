"use client";

import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import type { CitationCardItem } from "../../_lib/types";

interface InspectorSourceSectionProps {
  card: CitationCardItem;
  formattedPage: string;
  boxConfig: ReturnType<typeof getBoxTypeBadgeConfig>;
}

export function InspectorSourceSection({
  card,
  formattedPage,
  boxConfig,
}: InspectorSourceSectionProps) {
  return (
    <div className="space-y-2 pt-2 border-t border-border/40">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        Kaynak Bilgileri
      </h4>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-md bg-muted/20 border border-border/40 flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Eser Başlığı
          </span>
          <span
            className="font-medium text-foreground line-clamp-2"
            title={card.sourceTitle}
          >
            {card.sourceTitle}
          </span>
        </div>

        <div className="p-2.5 rounded-md bg-muted/20 border border-border/40 flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Yazar & Yıl
          </span>
          <span className="font-medium text-foreground truncate">
            {card.sourceAuthors.join(", ") || "Belirtilmemiş"} (
            {card.sourceYear})
          </span>
        </div>

        <div className="p-2.5 rounded-md bg-muted/20 border border-border/40 flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Sayfa Numarası
          </span>
          <span className="font-mono font-medium text-foreground">
            {formattedPage}
          </span>
        </div>

        <div className="p-2.5 rounded-md bg-muted/20 border border-border/40 flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Tematik Kutu (Menşe)
          </span>
          <span className="font-medium text-foreground truncate flex items-center gap-1">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                boxConfig.dotClassName,
              )}
            />
            {card.boxTitle}
          </span>
        </div>
      </div>
    </div>
  );
}
