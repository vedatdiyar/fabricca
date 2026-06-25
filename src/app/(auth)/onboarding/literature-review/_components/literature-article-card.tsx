import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JuryArticle } from "@/lib/types";
import { formatAcademicTitle } from "@/lib/utils/academic-formatter";

interface LiteratureArticleCardProps {
  article: JuryArticle;
}

export function LiteratureArticleCard({ article }: LiteratureArticleCardProps) {
  return (
    <Card className="bg-card border border-border hover:border-primary/20 transition-all">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium text-foreground leading-snug">
            {formatAcademicTitle(article.title)}
          </CardTitle>
          <div className="shrink-0 flex items-center gap-2">
            {article.isFoundational && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary">
                KURUCU ESER
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 px-3">
        <div className="text-xs text-muted-foreground leading-relaxed">
          {article.authors && article.authors.length > 0 && (
            <span>
              {article.authors.slice(0, 3).join(", ")}
              {article.authors.length > 3 ? " ve diğerleri" : ""}
            </span>
          )}
          {article.publicationYear && (
            <>
              <span className="mx-1.5 select-none">•</span>
              <span>{article.publicationYear}</span>
            </>
          )}
          {article.publisher && (
            <>
              <span className="mx-1.5 select-none">•</span>
              <span>{article.publisher}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
