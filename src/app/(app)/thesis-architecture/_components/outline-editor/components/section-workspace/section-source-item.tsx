"use client";

import Link from "next/link";
import { Source } from "@/core/db/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface SectionSourceItemProps {
  source: Source;
}

/**
 * Single source card within the section reading workspace with library
 * navigation actions.
 *
 * @param root0 - Component props.
 * @param root0.source - The source to render.
 */
export function SectionSourceItem({ source }: SectionSourceItemProps) {
  return (
    <Card className="p-4 space-y-3 transition-all border border-border/60 bg-card hover:border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {source.publicationYear && (
              <Badge
                variant="outline"
                className="font-mono text-[10px] border-primary/20 text-primary"
              >
                {source.publicationYear}
              </Badge>
            )}
            {source.documentType && (
              <Badge variant="secondary" className="text-[10px] font-sans">
                {source.documentType === "thesis" ? "Tez" : source.documentType}
              </Badge>
            )}
            {source.pdfStatus === "READY" && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
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
    </Card>
  );
}
