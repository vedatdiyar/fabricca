"use client";

import Link from "next/link";
import { Outline, Source, Annotation } from "@/core/db/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Quote,
  ExternalLink,
  BookOpen,
  Layers,
  CornerDownRight,
  ChevronRight,
  FolderTree,
} from "lucide-react";
import { SectionAnnotationItem } from "./section-annotation-item";

interface GroupedSubSectionData {
  outline: Outline;
  annotations: (Annotation & { source?: Source })[];
}

interface SectionSourcesListProps {
  sectionAnnotations: (Annotation & { source?: Source })[];
  isParentWithChildren?: boolean;
  groupedSubSectionAnnotations?: GroupedSubSectionData[];
  totalSectionCardsCount?: number;
  onSelectSection?: (sectionId: number) => void;
}

/**
 * Reading and writing workspace for the selected outline section:
 * - If selecting a parent chapter with children: displays a panoramic roll-up overview
 *   grouping citation cards by each child subsection.
 * - If selecting a leaf section: displays the direct list of citation cards.
 *
 * @param props - Component props.
 * @returns The section citation cards workspace markup.
 */
export function SectionSourcesList({
  sectionAnnotations,
  isParentWithChildren = false,
  groupedSubSectionAnnotations = [],
  totalSectionCardsCount = 0,
  onSelectSection,
}: SectionSourcesListProps) {
  // 1. Panoramic Overview for Parent Chapter with Subsections
  if (isParentWithChildren) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              <CardTitle className="font-serif text-base font-semibold text-foreground">
                Bölüm Panoraması: Alt Başlıkların Alıntı Fişleri
              </CardTitle>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] px-2 py-0.5"
              >
                {totalSectionCardsCount} Toplam Fiş
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
              >
                <Link href="/library">
                  <BookOpen className="h-3 w-3" />
                  <span>Kütüphane</span>
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
              >
                <Link href="/citation-cards">
                  <Layers className="h-3 w-3" />
                  <span>Alıntı Fişleri</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-6">
          {groupedSubSectionAnnotations.length > 0 ? (
            groupedSubSectionAnnotations.map(({ outline, annotations }) => (
              <div
                key={outline.id}
                className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-4 transition-colors hover:border-border"
              >
                {/* Sub-section Header Row */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <CornerDownRight className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-serif text-sm font-semibold text-foreground truncate">
                      {outline.title}
                    </span>
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] bg-background/80"
                    >
                      {annotations.length} Fiş
                    </Badge>
                  </div>

                  {onSelectSection && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => onSelectSection(outline.id)}
                    >
                      <span>Alt Bölüme Odaklan</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Sub-section Scope/Description (if any) */}
                {outline.description && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2.5">
                    {outline.description}
                  </p>
                )}

                {/* Sub-section Citation Cards */}
                {annotations.length > 0 ? (
                  <div className="space-y-2.5 pt-1">
                    {annotations.map((annotation) => (
                      <SectionAnnotationItem
                        key={annotation.id}
                        annotation={annotation}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-3 text-center border border-dashed border-border/50 rounded bg-background/40">
                    <p className="text-xs text-muted-foreground">
                      Bu alt başlığa henüz alıntı fişi bağlanmamış.
                    </p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Bu ana bölüme ait alt başlık bulunamadı.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // 2. Direct Reading/Writing Workspace for a Leaf Section
  return (
    <Card className="border-border bg-card">
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-primary" />
            <CardTitle className="font-serif text-base font-semibold text-foreground">
              Bölüm Alıntı Fişleri ve Yazım Malzemeleri
            </CardTitle>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] px-2 py-0.5"
            >
              {sectionAnnotations.length} Fiş
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
            >
              <Link href="/library">
                <BookOpen className="h-3 w-3" />
                <span>Kütüphane</span>
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
            >
              <Link href="/citation-cards">
                <Layers className="h-3 w-3" />
                <span>Alıntı Fişleri</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {sectionAnnotations.length > 0 ? (
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {sectionAnnotations.map((annotation) => (
              <SectionAnnotationItem
                key={annotation.id}
                annotation={annotation}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center space-y-3 border border-dashed border-border/60 rounded-lg bg-muted/10 p-6">
            <Quote className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
            <div className="space-y-1.5 max-w-md mx-auto">
              <p className="font-serif text-sm font-semibold text-foreground">
                Bu bölüme atanmış alıntı fişi bulunmuyor.
              </p>
              <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                Okuma yaparken alıntılarınızı bu bölüme bağlamak için{" "}
                <span className="font-medium text-foreground">Kütüphane</span>{" "}
                sayfasında not eklerken veya{" "}
                <span className="font-medium text-foreground">
                  Alıntı Fişleri
                </span>{" "}
                sayfasında bu bölümü seçebilirsiniz.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
              >
                <Link href="/library">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Kütüphaneden Alıntı Ekle</span>
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
              >
                <Link href="/citation-cards">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Alıntı Fişlerini İncele</span>
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
