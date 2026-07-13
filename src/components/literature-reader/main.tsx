"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  getBoxResourcesAction,
  toggleResourceReadStatusAction,
} from "@/app/(app)/library/actions";
import type {
  GetBoxResourcesResult,
  ToggleReadStatusResult,
} from "@/app/(app)/library/actions";
import { BoxTypeInfo } from "./box-type-info";
import { ReaderLoading } from "./reader-loading";
import { ReaderError } from "./reader-error";
import { ReaderCelebration } from "./reader-celebration";
import { ReaderEmptyState } from "./reader-empty-state";
import { ReaderResourceList } from "./reader-resource-list";

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
        return;
      }
      queryClient.invalidateQueries({ queryKey: BOX_KEY(boxId) });
    },
    onError: () => {
      toast.error("Okuma durumu güncellenirken bağlantı hatası oluştu.");
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

  /* ---- Content renderer ---- */
  const renderContent = () => {
    switch (status) {
      case "loading":
        return <ReaderLoading />;
      case "error":
        return <ReaderError onRetry={() => refetch()} />;
      case "all-read":
        return <ReaderCelebration />;
      case "reading":
        if (totalCount === 0) {
          return <ReaderEmptyState boxType={boxType} />;
        }
        return (
          <ReaderResourceList
            resources={resources}
            isPending={toggleMutation.isPending}
            onToggle={handleToggle}
          />
        );
    }
  };

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
        <BoxTypeInfo boxType={boxType} />
        {renderContent()}
      </CardContent>
    </Card>
  );
}
