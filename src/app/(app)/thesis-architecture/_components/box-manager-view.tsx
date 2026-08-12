"use client";

import { Box } from "@/db/schema";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Hash, FileText } from "lucide-react";

interface BoxManagerViewProps {
  boxesList: Box[];
}

const BOX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SUBJECT_PROBLEM: {
    label: "Araştırma Odağı",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  THEORETICAL_FRAMEWORK: {
    label: "Teorik Çerçeve",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  PRIMARY_MATERIAL: {
    label: "Birincil Malzeme",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  METHODOLOGY: {
    label: "Metodoloji",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  RELATED_THESES: {
    label: "İlgili Tezler",
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
};

export function BoxManagerView({ boxesList }: BoxManagerViewProps) {
  const rootBoxes = boxesList.filter((b) => !b.parentId);

  const getSubBoxes = (parentId: number) =>
    boxesList.filter((b) => b.parentId === parentId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Konu & Kavram Kutuları
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tezinizin literatür taramasına yön veren tematik arama kovanları ve
          bağlı kavram etiketleri.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {rootBoxes.map((rootBox) => {
          const subBoxes = getSubBoxes(rootBox.id);
          const typeInfo = BOX_TYPE_LABELS[rootBox.boxType ?? ""] ?? {
            label: rootBox.boxType ?? "Genel",
            color: "bg-muted text-muted-foreground",
          };

          return (
            <Card key={rootBox.id} className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {rootBox.title}
                      </CardTitle>
                      {rootBox.description && (
                        <CardDescription className="line-clamp-2 text-xs">
                          {rootBox.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${typeInfo.color}`}
                  >
                    {typeInfo.label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                {subBoxes.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Alt Konular ({subBoxes.length})
                    </div>
                    {subBoxes.map((subBox) => (
                      <div
                        key={subBox.id}
                        className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2 font-medium text-sm">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span>{subBox.title}</span>
                        </div>
                        {subBox.description && (
                          <p className="text-xs text-muted-foreground">
                            {subBox.description}
                          </p>
                        )}
                        {subBox.concepts && subBox.concepts.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {subBox.concepts.map((concept, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-[10px] gap-1 py-0 px-1.5"
                              >
                                <Hash className="h-2.5 w-2.5" />
                                {concept}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic text-muted-foreground">
                    Bu ana başlık altında henüz bir alt konu oluşturulmamış.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
