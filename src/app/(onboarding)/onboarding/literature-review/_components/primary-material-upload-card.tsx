"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedPdfDropzone } from "@/components/shared/dropzone";
import { LiteratureArticleCard } from "./literature-article-card";
import { usePrimaryMaterialUpload } from "../_hooks/use-primary-material-upload";
import type { JuryArticle } from "@/lib/types";

interface PrimaryMaterialUploadCardProps {
  /** Target thesis box database ID (child collection preferred). */
  thesisBoxId?: number;
  /** Already indexed documents for this collection, rendered like OpenAlex results. */
  articles: JuryArticle[];
}

/**
 * Renders the primary-material dropzone card: explanatory copy, drag-and-drop
 * PDF upload bound to the shared library pipeline, and the indexed documents
 * as standard article cards.
 *
 * @param root0 - Component props.
 * @param root0.thesisBoxId - Target thesis box database ID.
 * @param root0.articles - Already indexed documents for this collection.
 * @returns The primary-material upload card markup.
 */
export function PrimaryMaterialUploadCard({
  thesisBoxId,
  articles,
}: PrimaryMaterialUploadCardProps) {
  const router = useRouter();
  const { isUploading, statusMessage, uploadFiles } =
    usePrimaryMaterialUpload(thesisBoxId);

  const sortedArticles = [...articles].sort(
    (a, b) => b.relevanceScore - a.relevanceScore,
  );

  return (
    <div className="flex flex-col gap-3">
      {thesisBoxId ? (
        <UnifiedPdfDropzone
          variant="compact"
          multiple
          onUploadFiles={uploadFiles}
          isSubmitting={isUploading}
          statusMessage={statusMessage}
          className="border-primary/20 bg-background/60 mt-0"
        />
      ) : (
        <div className="flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-1 gap-1.5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => router.push("/library")}
          >
            <Plus className="size-3.5" />
            Kaynak Ekle
          </Button>
        </div>
      )}

      {sortedArticles.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="font-sans text-xs font-medium text-muted-foreground">
            Eklenen belgeler ({sortedArticles.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedArticles.map((article, index) => (
              <LiteratureArticleCard
                key={`${article.title}-${index}`}
                article={article}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
