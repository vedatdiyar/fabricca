import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JuryArticle } from "@/lib/types";

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
 * Renders a compact card summarizing a single jury article.
 *
 * @param root0 - Component props.
 * @param root0.article - The jury article to display.
 * @returns The article card UI.
 */
export function LiteratureArticleCard({ article }: LiteratureArticleCardProps) {
  return (
    <Card className="bg-card border border-border hover:border-primary/20 transition-all">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium text-foreground leading-snug break-words hyphens-auto min-w-0">
            {cleanDisplayTitle(article.title)}
          </CardTitle>
          <div className="shrink-0 flex items-center gap-2">
            {article.thesisType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary">
                {getThesisDegreeLabel(article.thesisType)}
              </span>
            )}
            {article.isFoundational && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary">
                KURUCU ESER
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 px-3">
        <div className="text-xs text-muted-foreground leading-relaxed truncate">
          {article.authors && article.authors.length > 0 && (
            <span>
              {article.authors.slice(0, 3).join(", ")}
              {article.authors.length > 3 ? " ve diğerleri" : ""}
            </span>
          )}
          {article.authors &&
            article.authors.length > 0 &&
            article.publisher && <span> · </span>}
          {article.publisher && <span>{article.publisher}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
