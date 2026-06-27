"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, BookOpen, RefreshCw, Layers } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getBoxResourcesAction,
  toggleResourceReadStatusAction,
} from "@/app/(app)/library/actions";
import type {
  GetBoxResourcesResult,
  ToggleReadStatusResult,
} from "@/app/(app)/library/actions";
import { formatAcademicTitle } from "@/lib/utils/academic-formatter";

/* ---------- Types ---------- */

interface LiteratureReaderProps {
  boxId: number;
  boxTitle: string;
  boxType?: string | null;
}

type ReaderStatus = "loading" | "error" | "reading" | "all-read";

/* ---------- Query Keys ---------- */

const BOX_KEY = (boxId: number) => ["box-resources", boxId] as const;

/* ---------- Component ---------- */

export function LiteratureReader({
  boxId,
  boxTitle,
  boxType,
}: LiteratureReaderProps) {
  const queryClient = useQueryClient();

  /* ---- Box Resources Query ---- */
  const {
    data: queryResult,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<GetBoxResourcesResult>({
    queryKey: BOX_KEY(boxId),
    queryFn: () => getBoxResourcesAction(boxId),
    staleTime: 5 * 60 * 1000,
  });

  /* ---- Toggle Read Status Mutation ---- */
  const toggleMutation = useMutation<
    ToggleReadStatusResult,
    Error,
    { resourceId: number; isRead: boolean }
  >({
    mutationFn: ({ resourceId, isRead }) =>
      toggleResourceReadStatusAction(resourceId, isRead),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
      }
    },
    onError: () => {
      toast.error("Okuma durumu güncellenirken bağlantı hatası oluştu.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BOX_KEY(boxId) });
    },
  });

  /* ---- Derived state ---- */
  const resources = queryResult?.success ? queryResult.data : [];
  const readCount = resources.filter((r) => r.isRead === true).length;
  const totalCount = resources.length;
  const allRead = totalCount > 0 && readCount === totalCount;

  /* ---- Reader status ---- */
  const status: ReaderStatus = (() => {
    if (isLoading) return "loading";
    if (isError) return "error";
    if (allRead && totalCount > 0) return "all-read";
    return "reading";
  })();

  /* ---- Toggle handler ---- */
  const handleToggle = useCallback(
    (resourceId: number, isRead: boolean) => {
      toggleMutation.mutate({ resourceId, isRead });
    },
    [toggleMutation],
  );

  /* ---------- Render ---------- */

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-serif text-xl font-semibold tracking-tight text-card-foreground">
                {boxTitle}
              </h2>
              <p className="text-sm text-muted-foreground">
                Okunan: {readCount} / {totalCount}
              </p>
            </div>
          </div>

          {status === "reading" && (
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20"
            >
              {totalCount - readCount} Kaynak Kaldı
            </Badge>
          )}

          {status === "all-read" && (
            <Badge
              variant="default"
              className="bg-success/10 text-success border-success/20 gap-1"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Tamamlandı
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-border/20">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{
              width:
                totalCount > 0 ? `${(readCount / totalCount) * 100}%` : "0%",
            }}
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {(boxType === "PRIMARY_MATERIAL" || boxType === "RELATED_THESES") && (
          <div className="p-6 border-b border-border/40 bg-primary/5">
            <div className="p-4 rounded-md bg-primary/10 border border-primary/20 leading-relaxed">
              <p className="font-medium text-foreground text-sm mb-1">
                {boxType === "RELATED_THESES"
                  ? "Sınırdaş Tez Havuzu"
                  : "Birincil Malzeme Alanı"}
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {boxType === "RELATED_THESES"
                  ? "Bu alan, özgünlük analizinde tespit edilen sınırdaş tez çalışmalarını barındırır."
                  : "Bu alan, yapacağınız saha çalışması verileri (mülakat deşifreleri, anketler) veya kütüphanelerden toplayacağınız birincil kaynaklar (gazete, doküman, arşiv belgeleri) için ayrılmış size özel bir veri havuzudur. Onboarding tamamlandıktan sonra kendi belgelerinizi buraya yükleyebilirsiniz."}
              </p>
            </div>
          </div>
        )}

        {/* ---- Loading ---- */}
        {status === "loading" && (
          <div className="flex flex-col gap-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-20 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        )}

        {/* ---- Error ---- */}
        {status === "error" && (
          <div className="flex flex-col items-center justify-center gap-4 p-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">
              <BookOpen className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error
                ? "Kaynaklar yüklenirken bir hata oluştu."
                : "Kaynaklar yüklenirken bir hata oluştu."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
              Yeniden Dene
            </Button>
          </div>
        )}

        {/* ---- All-read celebration ---- */}
        {status === "all-read" && totalCount > 0 && (
          <div className="animate-in fade-in flex flex-col items-center justify-center gap-4 p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-success/20 bg-success/10">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <p className="text-xl font-semibold text-foreground">Tebrikler!</p>
            <p className="text-center text-sm text-muted-foreground leading-relaxed">
              Bu kutuya ait tüm kaynakları okudunuz.
            </p>
          </div>
        )}

        {/* ---- Empty state ---- */}
        {status === "reading" && totalCount === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 p-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-muted/20 bg-muted/10">
              <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
            {boxType === "PRIMARY_MATERIAL" || boxType === "RELATED_THESES" ? (
              <p className="text-center text-sm text-muted-foreground max-w-md px-4 leading-relaxed">
                {boxType === "RELATED_THESES"
                  ? "Bu alan, özgünlük analizinde tespit edilen sınırdaş tez çalışmalarını barındırır. Kaynaklar onboarding süreci tamamlandığında otomatik olarak buraya eklenir."
                  : "Bu alan, yapacağınız saha çalışması verileri (mülakat deşifreleri, anketler) veya kütüphanelerden toplayacağınız birincil kaynaklar (gazete, doküman, arşiv belgeleri) için ayrılmış size özel bir veri havuzudur. Onboarding tamamlandıktan sonra kendi belgelerinizi buraya yükleyebilirsiniz."}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Bu kutu için onaylanmış kaynak bulunmuyor.
              </p>
            )}
          </div>
        )}

        {/* ---- Reading list ---- */}
        {status === "reading" && totalCount > 0 && (
          <ScrollArea className="h-[520px]">
            <div className="flex flex-col gap-0">
              {resources.map((resource, index) => (
                <div
                  key={resource.id}
                  className={`flex items-start gap-4 border-b border-border/40 px-6 py-4 transition-colors hover:bg-muted/20 ${
                    resource.isRead ? "opacity-70" : ""
                  }`}
                >
                  <Checkbox
                    id={`resource-${resource.id}`}
                    checked={resource.isRead === true}
                    onCheckedChange={(checked) => {
                      handleToggle(resource.id, checked === true);
                    }}
                    disabled={toggleMutation.isPending}
                    className="mt-1 shrink-0"
                    aria-label={
                      resource.isRead
                        ? "Okundu olarak işaretle"
                        : "Okunmadı olarak işaretle"
                    }
                  />

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        htmlFor={`resource-${resource.id}`}
                        className="cursor-pointer text-sm font-medium text-foreground leading-snug hover:text-primary transition-colors"
                      >
                        {formatAcademicTitle(resource.title)}
                      </label>
                    </div>

                    {resource.authors && resource.authors.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {resource.authors.join(", ")}
                        {resource.publicationYear
                          ? ` — ${resource.publicationYear}`
                          : ""}
                      </p>
                    )}

                    {resource.abstract && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {resource.abstract}
                      </p>
                    )}

                    {/* Order indicator */}
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <BookOpen className="h-3 w-3" />
                      Kaynak #{index + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
