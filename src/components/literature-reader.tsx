"use client";

import { useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, BookOpen, RefreshCw, Layers } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getApprovedResourcesAction,
  toggleResourceReadStatusAction,
  replenishFromReservedAction,
} from "@/app/(app)/library/actions";
import type {
  GetApprovedResourcesResult,
  ToggleReadStatusResult,
  ReplenishResult,
} from "@/app/(app)/library/actions";

/* ---------- Types ---------- */

interface LiteratureReaderProps {
  boxId: number;
  boxTitle: string;
}

type ReaderStatus =
  | "loading"
  | "error"
  | "reading"
  | "all-read"
  | "replenishing";

/* ---------- Query Keys ---------- */

const APPROVED_KEY = (boxId: number) =>
  ["box-resources", boxId, "approved"] as const;

/* ---------- Component ---------- */

export function LiteratureReader({ boxId, boxTitle }: LiteratureReaderProps) {
  const queryClient = useQueryClient();
  const replenishTriggeredRef = useRef(false);

  /* ---- Approved Resources Query ---- */
  const {
    data: queryResult,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<GetApprovedResourcesResult>({
    queryKey: APPROVED_KEY(boxId),
    queryFn: () => getApprovedResourcesAction(boxId),
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
      queryClient.invalidateQueries({ queryKey: APPROVED_KEY(boxId) });
    },
  });

  /* ---- Replenish Mutation ---- */
  const replenishMutation = useMutation<ReplenishResult, Error, void>({
    mutationFn: () => replenishFromReservedAction(boxId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Yeni kaynaklar başarıyla yüklendi.");
      } else {
        toast.info(result.error || "Kaynaklar hazırlanıyor...");
      }
    },
    onError: () => {
      toast.error("Kaynaklar yenilenirken bir hata oluştu.");
    },
    onSettled: () => {
      replenishTriggeredRef.current = false;
      queryClient.invalidateQueries({ queryKey: APPROVED_KEY(boxId) });
    },
  });

  /* ---- Derived state ---- */
  const resources = queryResult?.success ? queryResult.data : [];
  const readCount = resources.filter((r) => r.isRead === true).length;
  const totalCount = resources.length;
  const allRead = totalCount > 0 && readCount === totalCount;

  /* ---- Auto-trigger replenish when all read ---- */
  useEffect(() => {
    if (
      allRead &&
      totalCount > 0 &&
      !replenishMutation.isPending &&
      !replenishTriggeredRef.current
    ) {
      replenishTriggeredRef.current = true;
      replenishMutation.mutate();
    }
  }, [allRead, totalCount, replenishMutation, boxId]);

  /* ---- Reader status ---- */
  const status: ReaderStatus = (() => {
    if (isLoading) return "loading";
    if (isError) return "error";
    if (replenishMutation.isPending) return "replenishing";
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

  /* ---- Manual retry ---- */
  const handleRetryFetch = useCallback(() => {
    replenishTriggeredRef.current = true;
    replenishMutation.mutate();
  }, [replenishMutation]);

  /* ---------- Render ---------- */

  return (
    <Card className="border border-border/20 bg-card">
      <CardHeader className="border-b border-border/10 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
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
        {/* ---- Loading ---- */}
        {status === "loading" && (
          <div className="flex flex-col gap-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
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

        {/* ---- Replenishing ---- */}
        {status === "replenishing" && (
          <div className="flex animate-in fade-in flex-col items-center justify-center gap-4 p-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
              <RefreshCw className="h-7 w-7 animate-spin text-primary" />
            </div>
            <p className="text-base font-medium text-foreground">
              Yeni Kaynaklar Hazırlanıyor...
            </p>
            <p className="text-sm text-muted-foreground">
              Lütfen kısa süre bekleyin.
            </p>
            <div className="mt-2 flex gap-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
              <div
                className="h-2 w-2 animate-bounce rounded-full bg-primary"
                style={{ animationDelay: "0.1s" }}
              />
              <div
                className="h-2 w-2 animate-bounce rounded-full bg-primary"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
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
              <br />
              Yeni kaynaklar otomatik olarak hazırlanıyor.
            </p>
            <div className="mt-2 flex gap-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-success" />
              <div
                className="h-2 w-2 animate-bounce rounded-full bg-success"
                style={{ animationDelay: "0.1s" }}
              />
              <div
                className="h-2 w-2 animate-bounce rounded-full bg-success"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
          </div>
        )}

        {/* ---- Empty state ---- */}
        {status === "reading" && totalCount === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 p-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-muted/20 bg-muted/10">
              <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Bu kutu için onaylanmış kaynak bulunmuyor.
            </p>
          </div>
        )}

        {/* ---- Reading list ---- */}
        {status === "reading" && totalCount > 0 && (
          <ScrollArea className="h-[520px]">
            <div className="flex flex-col gap-0">
              {resources.map((resource, index) => (
                <div
                  key={resource.id}
                  className={`flex items-start gap-4 border-b border-border/10 px-6 py-4 transition-colors hover:bg-muted/30 ${
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

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        htmlFor={`resource-${resource.id}`}
                        className="cursor-pointer text-sm font-medium text-foreground leading-snug hover:text-primary transition-colors"
                      >
                        {resource.title}
                      </label>

                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] px-1.5 py-0 ${
                          resource.type === "PRIMARY"
                            ? "border-primary/20 text-primary"
                            : "border-info/20 text-info"
                        }`}
                      >
                        {resource.type === "PRIMARY" ? "Birincil" : "İkincil"}
                      </Badge>
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

            {/* Manual replenish button at the bottom of list */}
            {allRead && !replenishMutation.isPending && (
              <div className="flex items-center justify-center border-t border-border/10 bg-success/5 p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-success"
                  onClick={handleRetryFetch}
                  disabled={replenishMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4" />
                  Yeni Kaynakları Manuel Yükle
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
