"use client";

import Link from "next/link";
import { Source } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink } from "lucide-react";

interface SectionSourceItemProps {
  source: Source;
  isFocused: boolean;
  onToggleFocus: () => void;
}

/**
 * Single source card within the section reading workspace, with focus toggle
 * and library navigation actions.
 *
 * @param root0 - Component props.
 * @param root0.source - The source to render.
 * @param root0.isFocused - Whether this source is marked as primary for the section.
 * @param root0.onToggleFocus - Primary-source toggle handler.
 */
export function SectionSourceItem({
  source,
  isFocused,
  onToggleFocus,
}: SectionSourceItemProps) {
  return (
    <Card
      className={`p-4 space-y-3 transition-all border ${
        isFocused
          ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20"
          : "border-border/60 bg-card hover:border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isFocused && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-medium flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                <span>Ana Kaynak</span>
              </Badge>
            )}
            {source.publicationYear && (
              <Badge
                variant="outline"
                className="font-mono text-[10px] border-primary/20 text-primary"
              >
                {source.publicationYear}
              </Badge>
            )}
            {source.thesisType && (
              <Badge variant="secondary" className="text-[10px] font-sans">
                {source.thesisType}
              </Badge>
            )}
            {source.pdfStatus === "READY" && (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                PDF Mevcut
              </Badge>
            )}
          </div>

          <h4 className="font-serif text-sm font-semibold text-foreground leading-snug break-words">
            {source.title}
          </h4>

          {source.authors && source.authors.length > 0 && (
            <p className="font-sans text-xs text-muted-foreground">
              {source.authors.join(", ")}
            </p>
          )}

          {source.publisher && (
            <p className="font-sans text-[11px] text-muted-foreground/80 italic">
              {source.publisher}
            </p>
          )}
        </div>

        {/* Source Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <Button
            size="icon"
            variant={isFocused ? "default" : "outline"}
            onClick={onToggleFocus}
            className={`h-7 w-7 ${
              isFocused
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "text-muted-foreground hover:text-amber-500"
            }`}
            title={
              isFocused
                ? "Ana kaynak işaretini kaldır"
                : "Bu bölüm için ana kaynak olarak öne çıkar"
            }
            aria-label="Ana kaynak toggle"
          >
            <Star className={`h-3.5 w-3.5 ${isFocused ? "fill-white" : ""}`} />
          </Button>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 px-2.5"
          >
            <Link href={`/library?id=${source.id}`}>
              <span>Oku</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {source.comparisonNote && (
        <div className="text-xs text-muted-foreground/90 bg-muted/40 p-2.5 rounded-md border border-border/40 leading-relaxed font-sans italic">
          &quot;{source.comparisonNote}&quot;
        </div>
      )}
    </Card>
  );
}
