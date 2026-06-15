import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JuryArticle } from "@/lib/types";

interface LiteratureArticleCardProps {
  article: JuryArticle;
}

export function LiteratureArticleCard({ article }: LiteratureArticleCardProps) {
  const isPrimary = article.type === "PRIMARY";

  return (
    <Card className="bg-card/40 border border-border hover:border-primary/30 transition-all">
      <CardHeader className="pb-3">
        {/* Üst Bilgi: Badge + Metadata */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base font-bold text-foreground leading-snug">
              {article.title}
            </CardTitle>
            <CardDescription className="sr-only">
              {article.type} kaynak
            </CardDescription>
          </div>
          <span
            className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              isPrimary
                ? "bg-success/10 border-success/20 text-success"
                : "bg-info/10 border-info/20 text-info"
            }`}
          >
            {isPrimary ? "PRIMARY" : "SECONDARY"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Yazar, Yıl, Yayıncı Metadatası */}
        <div className="text-sm text-muted-foreground leading-relaxed">
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

        {/* Akademik Gerekçe & Katkı */}
        {article.strategicRecommendations && (
          <div className="bg-muted border-l-2 border-primary p-3 rounded-r-md">
            <p className="text-xs font-semibold text-foreground mb-1">
              Akademik Gerekçe & Katkı:
            </p>
            <p className="text-sm italic leading-relaxed text-foreground">
              {article.strategicRecommendations}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
