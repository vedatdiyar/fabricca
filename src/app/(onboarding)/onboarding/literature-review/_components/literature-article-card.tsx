"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
 * Renders a compact read-only card summarizing a single jury article.
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

  return (
    <Card className="hover:border-primary/20 transition-all">
      <CardHeader
        className={`p-4 ${hasMetadata ? "pb-2" : ""} flex flex-row items-center justify-between gap-2 space-y-0`}
      >
        <CardTitle className="text-sm font-medium text-foreground leading-snug break-words hyphens-auto min-w-0">
          {cleanDisplayTitle(article.title)}
        </CardTitle>
        <div className="shrink-0 flex items-center gap-1">
          {article.thesisType && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary">
              {getThesisDegreeLabel(article.thesisType)}
            </span>
          )}
        </div>
      </CardHeader>
      {hasMetadata && (
        <CardContent className="px-4 pb-3 pt-0">
          <div className="text-xs text-muted-foreground leading-relaxed truncate">
            <span>{authorDisplay}</span>
            {article.publisher &&
              article.authors &&
              article.authors.length > 0 &&
              article.publisher !== authorDisplay && (
                <span> · {article.publisher}</span>
              )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
