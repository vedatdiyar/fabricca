"use client";

import { TabActions } from "./tab-actions";
import { useState } from "react";
import { Box } from "@/db/schema";
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { updateBoxAction } from "../actions";
import { compareBoxTypes } from "@/lib/box-constants";
import {
  FolderKanban,
  Hash,
  FileText,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";

interface BoxManagerViewProps {
  boxesList: Box[];
}

const BOX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SUBJECT_PROBLEM: {
    label: "Araştırma Odağı",
    color: "bg-primary/10 text-primary border-primary/20",
  },
  THEORETICAL_FRAMEWORK: {
    label: "Teorik Çerçeve",
    color: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  },
  PRIMARY_MATERIAL: {
    label: "Birincil Malzeme",
    color: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
  METHODOLOGY: {
    label: "Metodoloji",
    color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  },
  RELATED_THESES: {
    label: "İlgili Tezler",
    color: "bg-secondary text-secondary-foreground border-border",
  },
};

interface BoxDraft {
  title: string;
  description: string;
}

export function BoxManagerView({ boxesList }: BoxManagerViewProps) {
  const [isGlobalEditing, setIsGlobalEditing] = useState(false);
  const [editingBoxId, setEditingBoxId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, BoxDraft>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const rootBoxes = boxesList
    .filter((b) => !b.parentId && b.boxType !== "RELATED_THESES")
    .sort((a, b) => compareBoxTypes(a.boxType, b.boxType));

  const getSubBoxes = (parentId: number) =>
    boxesList
      .filter((b) => b.parentId === parentId && b.boxType !== "RELATED_THESES")
      .sort((a, b) => compareBoxTypes(a.boxType, b.boxType));

  const toDraft = (box: Box): BoxDraft => ({
    title: box.title,
    description: box.description ?? "",
  });

  const startGlobalEdit = () => {
    const initial: Record<number, BoxDraft> = {};
    for (const box of boxesList) {
      if (box.boxType !== "RELATED_THESES") initial[box.id] = toDraft(box);
    }
    setDrafts(initial);
    setIsGlobalEditing(true);
  };

  const cancelGlobalEdit = () => {
    setDrafts({});
    setIsGlobalEditing(false);
    setEditingBoxId(null);
  };

  const startSingleEdit = (box: Box) => {
    setDrafts((prev) => ({ ...prev, [box.id]: toDraft(box) }));
    setEditingBoxId(box.id);
  };

  const cancelSingleEdit = (boxId: number) => {
    setEditingBoxId(null);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[boxId];
      return next;
    });
  };

  const handleSaveBox = async (box: Box) => {
    const draft = drafts[box.id];
    const titleToSave = draft ? draft.title : box.title;
    const descToSave = draft ? draft.description : (box.description ?? "");

    if (!titleToSave.trim()) {
      toast.error("Kutu başlığı boş olamaz.");
      return;
    }

    setSavingId(box.id);
    const res = await updateBoxAction({
      id: box.id,
      title: titleToSave,
      description: descToSave,
    });
    setSavingId(null);

    if (res.success) {
      toast.success("Kutu güncellendi.");
      if (editingBoxId === box.id) {
        setEditingBoxId(null);
      }
    } else {
      toast.error(res.error ?? "Kutu güncellenemedi.");
    }
  };

  const isBoxInEditMode = (boxId: number) => {
    return isGlobalEditing || editingBoxId === boxId;
  };

  return (
    <div className="w-full space-y-6">
      {/* Grid of Root Boxes */}
      <div className="grid gap-6 md:grid-cols-2">
        {rootBoxes.map((rootBox) => {
          const subBoxes = getSubBoxes(rootBox.id);
          const typeInfo = BOX_TYPE_LABELS[rootBox.boxType ?? ""] ?? {
            label: rootBox.boxType ?? "Genel",
            color: "bg-muted text-muted-foreground border-border",
          };
          const isRootEditing = isBoxInEditMode(rootBox.id);
          const rootDraft = drafts[rootBox.id] ?? toDraft(rootBox);
          const isRootSaving = savingId === rootBox.id;

          return (
            <Card
              key={rootBox.id}
              className={`flex flex-col h-full bg-card transition-all ${
                isRootEditing
                  ? "border-primary/40 ring-1 ring-primary/20"
                  : "border-border hover:border-border/80"
              }`}
            >
              <CardHeader className="space-y-3 pb-3">
                {/* Top Metadata Row: Badge & Action Icon Buttons */}
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={`shrink-0 border px-2.5 py-0.5 text-xs font-medium ${typeInfo.color}`}
                  >
                    {typeInfo.label}
                  </Badge>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isRootEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                          onClick={() => cancelSingleEdit(rootBox.id)}
                          disabled={isRootSaving}
                          aria-label="İptal"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>İptal</span>
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1"
                          onClick={() => handleSaveBox(rootBox)}
                          disabled={isRootSaving}
                          aria-label="Kaydet"
                        >
                          {isRootSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span>Kaydet</span>
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => startSingleEdit(rootBox)}
                        aria-label="Düzenle"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Content Row: Full Width Form or Heading */}
                {isRootEditing ? (
                  <div className="space-y-2.5 pt-1">
                    <Input
                      value={rootDraft.title}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [rootBox.id]: {
                            ...(prev[rootBox.id] ?? toDraft(rootBox)),
                            title: e.target.value,
                          },
                        }))
                      }
                      className="h-9 w-full font-sans text-sm font-medium bg-background/60 border-border/80 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md transition-all placeholder:text-muted-foreground/50"
                      placeholder="Kutu başlığı..."
                      autoFocus
                    />
                    <Textarea
                      value={rootDraft.description}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [rootBox.id]: {
                            ...(prev[rootBox.id] ?? toDraft(rootBox)),
                            description: e.target.value,
                          },
                        }))
                      }
                      rows={3}
                      className="textarea-academic w-full text-xs leading-relaxed p-2.5 border-border/80 focus:border-primary/40 rounded-md"
                      placeholder="Kutu açıklaması..."
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">
                      {rootBox.title}
                    </h3>
                    {rootBox.description && (
                      <CardDescription className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {rootBox.description}
                      </CardDescription>
                    )}
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex flex-1 flex-col justify-between space-y-4 pt-2">
                {subBoxes.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Alt Konular ({subBoxes.length})
                    </h4>
                    {subBoxes.map((subBox) => {
                      const isSubEditing = isBoxInEditMode(subBox.id);
                      const subDraft = drafts[subBox.id] ?? toDraft(subBox);
                      const isSubSaving = savingId === subBox.id;

                      return (
                        <div
                          key={subBox.id}
                          className={`rounded-md border p-3.5 transition-all min-h-[72px] flex flex-col justify-between ${
                            isSubEditing
                              ? "border-primary/40 bg-background/80 ring-1 ring-primary/20 shadow-xs space-y-3"
                              : "border-border/60 bg-muted/20 hover:border-border space-y-2"
                          }`}
                        >
                          {isSubEditing ? (
                            <div className="space-y-3">
                              <div className="flex items-start gap-2.5">
                                <FileText className="h-4 w-4 shrink-0 text-primary mt-2" />
                                <div className="flex-1 space-y-2.5">
                                  <Input
                                    value={subDraft.title}
                                    onChange={(e) =>
                                      setDrafts((prev) => ({
                                        ...prev,
                                        [subBox.id]: {
                                          ...(prev[subBox.id] ?? toDraft(subBox)),
                                          title: e.target.value,
                                        },
                                      }))
                                    }
                                    className="h-8.5 w-full font-sans text-xs font-medium bg-background border-border/80 text-foreground placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md transition-all"
                                    placeholder="Alt konu başlığı..."
                                    autoFocus
                                  />
                                  <Textarea
                                    value={subDraft.description}
                                    onChange={(e) =>
                                      setDrafts((prev) => ({
                                        ...prev,
                                        [subBox.id]: {
                                          ...(prev[subBox.id] ?? toDraft(subBox)),
                                          description: e.target.value,
                                        },
                                      }))
                                    }
                                    rows={3}
                                    className="textarea-academic w-full text-xs leading-relaxed p-2.5 border-border/80 focus:border-primary/40 rounded-md"
                                    placeholder="Alt konu açıklaması..."
                                  />
                                  {subBox.concepts &&
                                    subBox.concepts.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {subBox.concepts.map((concept, idx) => (
                                          <Badge
                                            key={idx}
                                            variant="secondary"
                                            className="gap-1 border border-border/30 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground/80"
                                          >
                                            <Hash className="h-2.5 w-2.5 text-muted-foreground/60" />
                                            {concept}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
                                {!isGlobalEditing && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => cancelSingleEdit(subBox.id)}
                                    disabled={isSubSaving}
                                    className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-md transition-colors"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    <span>İptal</span>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveBox(subBox)}
                                  disabled={isSubSaving}
                                  className="h-7 px-3.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5 rounded-md shadow-xs transition-all"
                                >
                                  {isSubSaving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  <span>Kaydet</span>
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                                  <span>{subBox.title}</span>
                                </div>
                                {!isGlobalEditing && (
                                  <button
                                    onClick={() => startSingleEdit(subBox)}
                                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    title="Alt konuyu düzenle"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              {subBox.description && (
                                <p className="pl-5 text-xs leading-relaxed text-muted-foreground">
                                  {subBox.description}
                                </p>
                              )}
                              {subBox.concepts &&
                                subBox.concepts.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pl-5 pt-1">
                                    {subBox.concepts.map((concept, idx) => (
                                      <Badge
                                        key={idx}
                                        variant="secondary"
                                        className="gap-1 border border-border/40 px-2 py-0.5 font-mono text-[10px]"
                                      >
                                        <Hash className="h-2.5 w-2.5 text-muted-foreground" />
                                        {concept}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-2 text-xs italic text-muted-foreground">
                    Bu ana başlık altında henüz bir alt konu tanımlanmamış.
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
