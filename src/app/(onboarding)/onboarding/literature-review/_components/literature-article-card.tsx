"use client";

import { Card } from "@/components/ui/card";
import type { JuryArticle } from "@/lib/types";
import { formatAuthorDisplayString } from "@/lib/academic/author-formatter";
import { stripAltTitle } from "@/lib/academic/title-utils";

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
  const stripped = stripAltTitle(title);
  if (stripped) return stripped;
  const separatorIndex = title.indexOf(" / ");
  return separatorIndex === -1 ? title : title.slice(0, separatorIndex).trim();
}

/**
 * Cleans institution / university name by removing department, faculty, and institute suffixes.
 * E.g. "Gazi Üniversitesi - Sosyoloji Ana Bilim Dalı" -> "Gazi Üniversitesi"
 *
 * @param publisher - Raw publisher or university string.
 * @returns Simplified university / institution name.
 */
function cleanInstitutionName(publisher?: string | null): string {
  if (!publisher) return "";
  const trimmed = publisher.trim();
  if (!trimmed) return "";

  // Split on common hierarchical separators ( - , / , \ , – , — )
  const parts = trimmed.split(/\s*[-/\\–—]\s*/);
  if (parts.length > 1) {
    const mainInstitution = parts[0]?.trim();
    if (mainInstitution && mainInstitution.length >= 3) {
      return mainInstitution;
    }
  }

  return trimmed
    .replace(
      /\s*,?\s*(?:sosyal|fen|sağlık|eğitim)?\s*bilimler(?:i)?\s*enstitüsü.*$/i,
      "",
    )
    .replace(/\s*,?\s*ana\s*bilim\s*dalı.*$/i, "")
    .replace(/\s*,?\s*anabilim\s*dalı.*$/i, "")
    .replace(/\s*,?\s*bölümü.*$/i, "")
    .replace(/\s*,?\s*fakültesi.*$/i, "")
    .replace(/\s*,?\s*department of.*$/i, "")
    .replace(/\s*,?\s*faculty of.*$/i, "")
    .replace(/\s*,?\s*institute of.*$/i, "")
    .trim();
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
  const institutionDisplay = cleanInstitutionName(article.publisher);
  const containerTitle = article.containerTitle?.trim();
  const isBookChapter =
    article.documentType?.toLowerCase().includes("chapter") ||
    article.thesisType?.toLowerCase().includes("chapter") ||
    Boolean(
      containerTitle &&
        article.publisher &&
        containerTitle !== article.publisher,
    );

  return (
    <Card className="flex flex-col justify-between p-4 rounded-md border-border/60 hover:border-primary/30 transition-all bg-card/60 gap-2.5 min-h-[96px]">
      <div className="space-y-1 min-w-0">
        <h4
          className="font-serif text-sm font-semibold leading-snug break-words hyphens-auto min-w-0 tracking-tight text-foreground line-clamp-2"
          title={article.title}
        >
          {displayTitle}
        </h4>

        {isBookChapter && containerTitle && (
          <p
            className="font-sans text-xs text-muted-foreground truncate"
            title={`içinde: ${containerTitle}`}
          >
            <span className="text-foreground/70 italic font-serif">içinde:</span>{" "}
            <span className="italic font-medium text-foreground/90">
              {containerTitle}
            </span>
          </p>
        )}
      </div>

      {hasMetadata && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40 gap-2">
          <span
            className="truncate font-normal text-muted-foreground"
            title={authorDisplay}
          >
            {authorDisplay}
          </span>
          {institutionDisplay &&
            institutionDisplay !== authorDisplay &&
            institutionDisplay !== containerTitle && (
              <span
                className="truncate text-foreground/80 shrink-0 text-[11px] font-medium max-w-[45%]"
                title={institutionDisplay}
              >
                {institutionDisplay}
              </span>
            )}
        </div>
      )}
    </Card>
  );
}
