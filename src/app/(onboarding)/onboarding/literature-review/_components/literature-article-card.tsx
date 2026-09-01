"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  return (
    <Card className="p-4 space-y-2 rounded-md border-border/60 hover:border-primary/30 transition-all bg-card/60">
      <div className="flex items-start justify-between gap-2.5">
        <h4
          className="font-serif text-sm font-semibold leading-snug break-words hyphens-auto min-w-0 tracking-tight text-foreground"
          title={article.title}
        >
          {displayTitle}
        </h4>
        {article.thesisType && (
          <Badge
            variant="outline"
            className="shrink-0 px-2 py-0.5 rounded-md text-xs font-medium border-primary/20 bg-primary/10 text-primary"
          >
            {getThesisDegreeLabel(article.thesisType)}
          </Badge>
        )}
      </div>
      {hasMetadata && (
        <div className="font-sans text-xs text-muted-foreground leading-relaxed truncate">
          <span>{authorDisplay}</span>
          {institutionDisplay &&
            article.authors &&
            article.authors.length > 0 &&
            institutionDisplay !== authorDisplay && (
              <span> · {institutionDisplay}</span>
            )}
        </div>
      )}
    </Card>
  );
}
