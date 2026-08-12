"use client";

import { TabActions } from "./tab-actions";
import { useState } from "react";
import Link from "next/link";
import { Outline, Box, Annotation, Source } from "@/db/schema";
import {
  createOutlineSectionAction,
  updateOutlineSectionAction,
  deleteOutlineSectionAction,
} from "../actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Trash2,
  ChevronRight,
  Pencil,
  FileText,
  ExternalLink,
  Layers,
  Star,
} from "lucide-react";

function isIntroOrConclusion(title: string): boolean {
  const titleUpper = title.toLocaleUpperCase("tr-TR");
  return (
    titleUpper.includes("GİRİŞ") ||
    titleUpper.includes("GIRIS") ||
    titleUpper.includes("SONUÇ") ||
    titleUpper.includes("SONUC")
  );
}

interface OutlineEditorViewProps {
  outlinesList: Outline[];
  boxesList: Box[];
  sourcesList?: Source[];
  annotationsList: (Annotation & { source?: Source })[];
  pinnedMap: Record<number, number[]>;
  linkedBoxMap: Record<number, number[]>;
}

export function OutlineEditorView({
  outlinesList,
  boxesList,
  sourcesList = [],
  annotationsList,
  linkedBoxMap,
}: OutlineEditorViewProps) {
  const [selectedOutline, setSelectedOutline] = useState<Outline | null>(
    outlinesList.length > 0 ? outlinesList[0] : null,
  );

  // Add new section state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newParentId, setNewParentId] = useState<number | null>(null);

  // Edit section state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Section focused sources state (outlineId -> set of sourceIds)
  const [focusedSourceMap, setFocusedSourceMap] = useState<
    Record<number, number[]>
  >({});

  const isEmpty = outlinesList.length === 0;

  const rootOutlines = outlinesList
    .filter((o) => !o.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const getSubOutlines = (parentId: number) =>
    outlinesList
      .filter((o) => o.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const handleCreateSection = async () => {
    if (!newTitle.trim()) {
      toast.error("Lütfen bölüm başlığı girin.");
      return;
    }
    const res = await createOutlineSectionAction({
      title: newTitle,
      description: newDescription,
      parentId: newParentId,
    });
    if (res.success) {
      toast.success("Bölüm eklendi.");
      setIsAddOpen(false);
      setNewTitle("");
      setNewDescription("");
    } else {
      toast.error(res.error ?? "Bölüm eklenemedi.");
    }
  };

  const handleUpdateSection = async () => {
    if (!selectedOutline) return;
    const res = await updateOutlineSectionAction({
      id: selectedOutline.id,
      title: editTitle,
      description: editDescription,
    });
    if (res.success) {
      toast.success("Bölüm güncellendi.");
      setIsEditOpen(false);
    } else {
      toast.error(res.error ?? "Bölüm güncellenemedi.");
    }
  };

  const handleDeleteSection = async (id: number) => {
    const res = await deleteOutlineSectionAction(id);
    if (res.success) {
      toast.success("Bölüm silindi.");
      if (selectedOutline?.id === id) {
        setSelectedOutline(outlinesList.find((o) => o.id !== id) ?? null);
      }
    } else {
      toast.error(res.error ?? "Bölüm silinemedi.");
    }
  };

  const toggleSourceFocus = (outlineId: number, sourceId: number) => {
    setFocusedSourceMap((prev) => {
      const current = prev[outlineId] || [];
      const exists = current.includes(sourceId);
      const updated = exists
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId];

      if (!exists) {
        toast.success("Kaynak bu bölüm için öne çıkarıldı.");
      }
      return { ...prev, [outlineId]: updated };
    });
  };

  const activeLinkedBoxIds = selectedOutline
    ? (linkedBoxMap[selectedOutline.id] ?? [])
    : [];

  // Sources belonging to the boxes linked to this selected outline section
  const sectionSources = sourcesList.filter((s) =>
    s.boxId ? activeLinkedBoxIds.includes(s.boxId) : false,
  );

  const activeFocusedSourceIds = selectedOutline
    ? (focusedSourceMap[selectedOutline.id] ?? [])
    : [];

  // Sort sources so focused/starred sources appear first
  const sortedSectionSources = [...sectionSources].sort((a, b) => {
    const aFocused = activeFocusedSourceIds.includes(a.id);
    const bFocused = activeFocusedSourceIds.includes(b.id);
    if (aFocused && !bFocused) return -1;
    if (!aFocused && bFocused) return 1;
    return 0;
  });

  // Count of annotations per source
  const annotationCountMap = new Map<number, number>();
  for (const anno of annotationsList) {
    if (anno.sourceId) {
      annotationCountMap.set(
        anno.sourceId,
        (annotationCountMap.get(anno.sourceId) || 0) + 1,
      );
    }
  }

  return (
    <div className="space-y-6">
      <TabActions>
        <Button
          size="sm"
          onClick={() => {
            setNewParentId(null);
            setIsAddOpen(true);
          }}
          className="gap-2 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Yeni Bölüm Ekle</span>
        </Button>
      </TabActions>

      {isEmpty ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border bg-card">
          <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="font-serif text-base font-semibold text-foreground mb-1">
            Henüz Tez Bölüm Planı Oluşturulmadı
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mb-4">
            Onboarding aşamasındaki tez matrisinize dayanarak otomatik bölüm
            planı üretebilir veya kendiniz manuel bölümler ekleyebilirsiniz.
          </p>
          <Button
            size="sm"
            onClick={() => {
              setNewParentId(null);
              setIsAddOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>İlk Bölümü Ekle</span>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Outline Sidebar (Library Sidebar Work List Style) */}
          <div className="lg:col-span-4 space-y-3 sticky top-6">
            <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs space-y-3">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-foreground">
                    Bölüm İskeleti
                  </h4>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full font-medium">
                  {rootOutlines.length} Ana Bölüm
                </span>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
                {rootOutlines.map((root, idx) => {
                  const subItems = getSubOutlines(root.id);
                  const isSelected = selectedOutline?.id === root.id;
                  const rootLinkedBoxIds = linkedBoxMap[root.id] ?? [];
                  const rootSourceCount = sourcesList.filter((s) =>
                    s.boxId ? rootLinkedBoxIds.includes(s.boxId) : false,
                  ).length;

                  return (
                    <div key={root.id} className="space-y-1">
                      {/* Root Chapter Item (Full title displayed without truncation) */}
                      <div
                        onClick={() => setSelectedOutline(root)}
                        className={`group relative flex cursor-pointer items-start justify-between rounded-lg border p-3 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground font-semibold shadow-xs ring-1 ring-primary/20"
                            : "border-border/60 bg-card hover:border-border text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-1">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary border border-primary/20 text-xs font-bold font-mono">
                            {idx + 1}
                          </span>
                          <div className="space-y-1 min-w-0 flex-1">
                            <span className="font-serif text-sm font-semibold leading-snug block break-words whitespace-normal">
                              {root.title}
                            </span>
                            {rootSourceCount > 0 && (
                              <div className="flex items-center gap-1 pt-0.5">
                                <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
                                  <FileText className="h-3 w-3 shrink-0" />
                                  {rootSourceCount} kaynak
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          {!isIntroOrConclusion(root.title) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewParentId(root.id);
                                setIsAddOpen(true);
                              }}
                              title="Alt Bölüm Ekle"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${
                              isSelected
                                ? "text-primary translate-x-0.5"
                                : "text-muted-foreground/60"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Sub Outlines (Full title displayed without truncation) */}
                      {subItems.length > 0 && (
                        <div className="ml-4 space-y-1 border-l-2 border-primary/25 pl-2.5 pt-0.5">
                          {subItems.map((sub, subIdx) => {
                            const isSubSelected =
                              selectedOutline?.id === sub.id;
                            const subLinkedBoxIds = linkedBoxMap[sub.id] ?? [];
                            const subSourceCount = sourcesList.filter((s) =>
                              s.boxId
                                ? subLinkedBoxIds.includes(s.boxId)
                                : false,
                            ).length;

                            return (
                              <div
                                key={sub.id}
                                onClick={() => setSelectedOutline(sub)}
                                className={`flex cursor-pointer items-start justify-between rounded-md border p-2.5 text-xs transition-all ${
                                  isSubSelected
                                    ? "border-primary/60 bg-primary/10 text-foreground font-semibold ring-1 ring-primary/20"
                                    : "border-border/40 bg-card/80 hover:border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                }`}
                              >
                                <div className="flex items-start gap-2 min-w-0 flex-1 pr-1">
                                  <span className="font-mono text-xs font-bold text-primary shrink-0 pt-0.5">
                                    {idx + 1}.{subIdx + 1}
                                  </span>
                                  <span className="font-sans font-medium text-foreground break-words whitespace-normal leading-snug">
                                    {sub.title}
                                  </span>
                                </div>
                                {subSourceCount > 0 && (
                                  <span className="font-mono text-[10px] text-primary shrink-0 pt-0.5">
                                    {subSourceCount}k
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Selected Section & Linked Sources */}
          <div className="lg:col-span-8 space-y-6">
            {selectedOutline ? (
              <div className="space-y-6">
                {/* Section Header Card */}
                <Card className="border-border bg-card shadow-xs">
                  <CardHeader className="pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/10 text-primary text-[11px] font-mono"
                          >
                            {selectedOutline.parentId
                              ? "Alt Bölüm"
                              : "Ana Bölüm"}
                          </Badge>
                          {selectedOutline.academicField && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-sans"
                            >
                              {selectedOutline.academicField}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="font-serif text-xl font-semibold text-foreground leading-snug break-words">
                          {selectedOutline.title}
                        </CardTitle>
                        <CardDescription className="text-xs leading-relaxed text-muted-foreground break-words">
                          {selectedOutline.description ||
                            "Bu bölümün yazım kapsamı ve odağı henüz tanımlanmamış."}
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => {
                            setEditTitle(selectedOutline.title);
                            setEditDescription(
                              selectedOutline.description ?? "",
                            );
                            setIsEditOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Düzenle</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            handleDeleteSection(selectedOutline.id)
                          }
                          title="Bölümü Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Section: Linked Library Sources */}
                <Card className="border-border bg-card shadow-xs">
                  <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm font-semibold font-sans">
                        Bölüm Okuma Kaynakları
                      </CardTitle>
                      <Badge
                        variant="secondary"
                        className="font-mono text-xs px-2 py-0.5"
                      >
                        {sectionSources.length} Kaynak
                      </Badge>
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
                  </CardHeader>

                  <CardContent className="pt-4">
                    {sortedSectionSources.length > 0 ? (
                      <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                        {sortedSectionSources.map((source) => {
                          const annoCount =
                            annotationCountMap.get(source.id) || 0;
                          const isFocused = activeFocusedSourceIds.includes(
                            source.id,
                          );

                          return (
                            <div
                              key={source.id}
                              className={`rounded-lg border p-4 space-y-2.5 transition-all ${
                                isFocused
                                  ? "border-amber-500/50 bg-amber-500/5 shadow-2xs ring-1 ring-amber-500/20"
                                  : "border-border/60 bg-card hover:border-border"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isFocused && (
                                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-medium flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                        <span>Ana Kaynak</span>
                                      </Badge>
                                    )}
                                    {source.publicationYear && (
                                      <Badge
                                        variant="outline"
                                        className="font-mono text-[10px] border-primary/20 text-primary"
                                      >
                                        {source.publicationYear}
                                      </Badge>
                                    )}
                                    {source.thesisType && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px]"
                                      >
                                        {source.thesisType}
                                      </Badge>
                                    )}
                                    {source.pdfStatus === "READY" && (
                                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                                        PDF var
                                      </Badge>
                                    )}
                                    {annoCount > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="font-mono text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                                      >
                                        {annoCount} Alıntı / Not
                                      </Badge>
                                    )}
                                  </div>

                                  <h5 className="font-serif text-sm font-semibold text-foreground leading-snug break-words pt-0.5">
                                    {source.title}
                                  </h5>

                                  {source.authors &&
                                    source.authors.length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {source.authors.join(", ")}
                                      </p>
                                    )}

                                  {source.publisher && (
                                    <p className="text-[11px] text-muted-foreground/80 italic">
                                      {source.publisher}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                  <Button
                                    size="icon"
                                    variant={isFocused ? "default" : "outline"}
                                    onClick={() =>
                                      toggleSourceFocus(
                                        selectedOutline.id,
                                        source.id,
                                      )
                                    }
                                    className={`h-7 w-7 ${
                                      isFocused
                                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                                        : "text-muted-foreground hover:text-amber-500"
                                    }`}
                                    title={
                                      isFocused
                                        ? "Odaktan çıkar"
                                        : "Bu bölüm için öne çıkar / odakla"
                                    }
                                  >
                                    <Star
                                      className={`h-3.5 w-3.5 ${
                                        isFocused ? "fill-white" : ""
                                      }`}
                                    />
                                  </Button>

                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1 px-2.5"
                                  >
                                    <Link href={`/library?id=${source.id}`}>
                                      <span>Oku</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  </Button>
                                </div>
                              </div>

                              {source.comparisonNote && (
                                <p className="text-xs text-muted-foreground/90 bg-muted/40 p-2.5 rounded-md border border-border/40 leading-relaxed italic">
                                  &quot;{source.comparisonNote}&quot;
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-10 text-center space-y-2 border border-dashed border-border/60 rounded-lg">
                        <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="text-xs text-muted-foreground">
                          Bu bölüme henüz bağlı bir okuma kaynağı bulunmuyor.
                          Kütüphanede eklediğiniz kaynaklar otomatik olarak bu
                          bölüme yansır.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border bg-card min-h-[350px]">
                <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
                <h4 className="font-serif text-base font-semibold text-foreground mb-1">
                  Bölüm Detaylarını Görüntüleyin
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Detaylarını incelemek ve bağlı okuma kaynaklarını görmek için
                  soldaki Bölüm İskeletinden bir bölüm seçin.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Dialog: Add Section */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-semibold text-foreground">
              Yeni Tez Bölümü Ekle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="font-sans text-xs font-medium text-foreground">
                Bölüm Başlığı
              </label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Örn: 1991-1995 Talep İçeriğinin İlk Dönüşümü"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-2">
              <label className="font-sans text-xs font-medium text-foreground">
                Yazım Kapsamı & Açıklama
              </label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={4}
                className="textarea-academic w-full text-xs"
                placeholder="Bu bölümde ele alınacak ana tartışma ve odak..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddOpen(false)}
            >
              İptal
            </Button>
            <Button size="sm" onClick={handleCreateSection}>
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Section */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-semibold text-foreground">
              Bölümü Düzenle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="font-sans text-xs font-medium text-foreground">
                Bölüm Başlığı
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-2">
              <label className="font-sans text-xs font-medium text-foreground">
                Yazım Kapsamı & Açıklama
              </label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="textarea-academic w-full text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(false)}
            >
              İptal
            </Button>
            <Button size="sm" onClick={handleUpdateSection}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
