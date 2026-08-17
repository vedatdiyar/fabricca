"use client";

import Link from "next/link";
import { Source, Annotation } from "@/core/db/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, FileText, ExternalLink, Quote, Link2 } from "lucide-react";
import { SectionSourceItem } from "./section-source-item";
import { SectionAnnotationItem } from "./section-annotation-item";

interface SectionSourcesListProps {
  sectionAnnotations: (Annotation & { source?: Source })[];
  sectionSources: Source[];
  displayedSources: Source[];
  sourceSearchQuery: string;
  onSourceSearchChange: (query: string) => void;
  onManageAnnotationLinks: () => void;
  onManageSourceLinks: () => void;
}

/**
 * Reading workspace of the selected section: it lists the citation cards
 * (fişler) pinned directly to the section and the sources directly linked to
 * it, with dedicated link-management actions per list.
 *
 * @param root0 - Component props.
 * @param root0.sectionAnnotations - Citation cards pinned to this section.
 * @param root0.sectionSources - All sources directly linked to this section.
 * @param root0.displayedSources - Filtered/sorted sources to render.
 * @param root0.sourceSearchQuery - The current source search query.
 * @param root0.onSourceSearchChange - Search query mutator.
 * @param root0.onManageAnnotationLinks - Annotation (fiş) link management handler.
 * @param root0.onManageSourceLinks - Source link management handler.
 */
export function SectionSourcesList({
  sectionAnnotations,
  sectionSources,
  displayedSources,
  sourceSearchQuery,
  onSourceSearchChange,
  onManageAnnotationLinks,
  onManageSourceLinks,
}: SectionSourcesListProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="font-serif text-base font-semibold text-foreground">
              Bölüm Çalışma Masası
            </CardTitle>
          </div>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
          >
            <Link href="/library">
              <span>Tüm Kütüphaneyi Aç</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-6">
        {/* 1. Pinned Citation Cards (Alıntı Kartları / Fişler) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Quote className="h-4 w-4 text-emerald-500" />
              <h4 className="font-sans text-sm font-semibold text-foreground">
                İliştirilmiş Alıntı Kartları
              </h4>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] px-2 py-0.5"
              >
                {sectionAnnotations.length} Fiş
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onManageAnnotationLinks}
              className="h-7 text-xs gap-1.5 shrink-0"
            >
              <Quote className="h-3 w-3" />
              <span>Fişleri Yönet</span>
            </Button>
          </div>

          {sectionAnnotations.length > 0 ? (
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {sectionAnnotations.map((annotation) => (
                <SectionAnnotationItem
                  key={annotation.id}
                  annotation={annotation}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center space-y-2 border border-dashed border-border/60 rounded-lg bg-muted/5">
              <Quote className="h-7 w-7 text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <p className="font-serif text-sm font-semibold text-foreground">
                  Bu bölüme henüz alıntı kartı bağlanmadı.
                </p>
                <p className="font-sans text-xs text-muted-foreground max-w-sm mx-auto">
                  Okuma notlarınızdan ilgili alıntı, açımlama veya kişisel
                  notları bu bölüme doğrudan iliştirebilirsiniz.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onManageAnnotationLinks}
                className="text-xs gap-1.5"
              >
                <Quote className="h-3.5 w-3.5" />
                <span>Alıntı Kartı Bağla</span>
              </Button>
            </div>
          )}
        </div>

        {/* 2. Directly Linked Sources (Kullanılan Kaynaklar) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-amber-500" />
              <h4 className="font-sans text-sm font-semibold text-foreground">
                Kullanılan Kaynaklar
              </h4>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] px-2 py-0.5"
              >
                {sectionSources.length} Kaynak
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onManageSourceLinks}
              className="h-7 text-xs gap-1.5 shrink-0"
            >
              <Link2 className="h-3 w-3" />
              <span>Kaynakları Yönet</span>
            </Button>
          </div>

          {/* Search Bar for Sources */}
          {sectionSources.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={sourceSearchQuery}
                onChange={(e) => onSourceSearchChange(e.target.value)}
                placeholder="Bağlı kaynaklarda başlık, yazar veya yayıncı ara..."
                className="h-8 pl-8 pr-7 text-xs bg-background/50 border-border/60"
              />
              {sourceSearchQuery && (
                <button
                  type="button"
                  onClick={() => onSourceSearchChange("")}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {displayedSources.length > 0 ? (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {displayedSources.map((source) => (
                <SectionSourceItem key={source.id} source={source} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center space-y-2 border border-dashed border-border/60 rounded-lg bg-muted/5">
              <Link2 className="h-7 w-7 text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <p className="font-serif text-sm font-semibold text-foreground">
                  {sourceSearchQuery
                    ? "Aramanızla eşleşen kaynak bulunamadı."
                    : "Bu bölüme henüz doğrudan kaynak bağlanmadı."}
                </p>
                <p className="font-sans text-xs text-muted-foreground max-w-sm mx-auto">
                  Kütüphanenizdeki eserleri bu bölüme doğrudan bağlayarak yazım
                  sürecinde kullanacağınız kaynak setini oluşturabilirsiniz.
                </p>
              </div>
              {!sourceSearchQuery && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onManageSourceLinks}
                  className="text-xs gap-1.5"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Kaynak Bağla</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
