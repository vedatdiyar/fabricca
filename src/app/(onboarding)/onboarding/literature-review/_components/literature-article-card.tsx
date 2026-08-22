"use client";

import { Card } from "@/components/ui/card";
import type { JuryArticle } from "@/lib/types";
import { formatAuthorDisplayString } from "@/lib/academic/author-formatter";

interface LiteratureArticleCardProps {
  article: JuryArticle;
}

/**
 * Cuts a YÖK-style dual-language thesis title down to its primary (Turkish) portion.
 *
 * @param title - The raw title possibly containing a "Türkçe / English" separator.
 * @returns The primary title fragment, or the raw title when no separator exists.
 */
function cleanDisplayTitle(title: string): string {
  const separatorIndex = title.indexOf(" / ");
  return separatorIndex === -1 ? title : title.slice(0, separatorIndex).trim();
}

/**
 * Maps a raw thesis degree string to a compact badge label.
 *
 * @param thesisType - The raw thesis type value.
 * @returns A short uppercase degree label.
 */
function getThesisDegreeLabel(thesisType: string): string {
  const normalized = thesisType.toLowerCase();
  if (normalized.includes("doktora")) return "DOKTORA";
  if (normalized.includes("yüksek")) return "YÜKSEK LİSANS";
  return thesisType.toUpperCase();
}

/**
 * Renders a compact read-only card summarizing a single jury article with refined typography.
 *
 * @param root0 - Component props.
 * @param root0.article - The jury article to display.
 * @returns The article card UI.
 */
export function LiteratureArticleCard({ article }: LiteratureArticleCardProps) {
  const authorDisplay = formatAuthorDisplayString({
    authors: article.authors,
    publisher: article.publisher,
  });

  const hasMetadata = Boolean(authorDisplay);
  const displayTitle = cleanDisplayTitle(article.title);

  return (
    <Card className="p-3.5 space-y-1.5 rounded-md hover:border-primary/20 transition-all">
      <div className="flex items-start justify-between gap-2">
        <h4
          className="text-xs font-medium text-foreground leading-snug break-words hyphens-auto min-w-0"
          title={article.title}
        >
          {displayTitle}
        </h4>
        {article.thesisType && (
          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary">
            {getThesisDegreeLabel(article.thesisType)}
          </span>
        )}
      </div>
      {hasMetadata && (
        <div className="text-[11px] text-muted-foreground leading-tight truncate">
          <span>{authorDisplay}</span>
          {article.publisher &&
            article.authors &&
            article.authors.length > 0 &&
            article.publisher !== authorDisplay && (
              <span> · {article.publisher}</span>
            )}
        </div>
      )}
    </Card>
  );
}


