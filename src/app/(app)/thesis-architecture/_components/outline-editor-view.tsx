"use client";

import { useState } from "react";
import { Outline, Box, Annotation, Source } from "@/db/schema";
import {
  createOutlineSectionAction,
  updateOutlineSectionAction,
  deleteOutlineSectionAction,
  pinAnnotationAction,
  unpinAnnotationAction,
  linkBoxToOutlineAction,
  unlinkBoxFromOutlineAction,
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
  Edit2,
  Pin,
  PinOff,
  FolderKanban,
  Quote,
  ChevronRight,
  Pencil,
  Check,
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
  annotationsList: (Annotation & { source?: Source })[];
  pinnedMap: Record<number, number[]>; // outlineId -> annotationId[]
  linkedBoxMap: Record<number, number[]>; // outlineId -> boxId[]
}

export function OutlineEditorView({
  outlinesList,
  boxesList,
  annotationsList,
  pinnedMap,
  linkedBoxMap,
}: OutlineEditorViewProps) {
  const [selectedOutline, setSelectedOutline] = useState<Outline | null>(
    outlinesList.length > 0 ? outlinesList[0] : null,
  );

  const [isEditing, setIsEditing] = useState(false);

  // Add new section state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newParentId, setNewParentId] = useState<number | null>(null);

  // Edit section state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

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

  const handleTogglePin = async (outlineId: number, annotationId: number) => {
    const pinned = pinnedMap[outlineId]?.includes(annotationId);
    if (pinned) {
      const res = await unpinAnnotationAction(outlineId, annotationId);
      if (res.success) toast.success("Alıntı fişi iğnesi kaldırıldı.");
    } else {
      const res = await pinAnnotationAction(outlineId, annotationId);
      if (res.success) toast.success("Alıntı fişi bölüme iğnelendi.");
    }
  };

  const handleToggleBoxLink = async (outlineId: number, boxId: number) => {
    const linked = linkedBoxMap[outlineId]?.includes(boxId);
    if (linked) {
      const res = await unlinkBoxFromOutlineAction(outlineId, boxId);
      if (res.success) toast.success("Kutu bağı kaldırıldı.");
    } else {
      const res = await linkBoxToOutlineAction(outlineId, boxId);
      if (res.success) toast.success("Kutu bölüme bağlandı.");
    }
  };

  const activePinnedAnnotationIds = selectedOutline
    ? (pinnedMap[selectedOutline.id] ?? [])
    : [];

  const activeLinkedBoxIds = selectedOutline
    ? (linkedBoxMap[selectedOutline.id] ?? [])
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Tez İçindekiler & Bölüm Planı
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Bölüm planınızı yapılandırın, bölümlere Konu Kutuları bağlayın ve
            Alıntı Fişlerini kanıt olarak bölümlere iğneleyin.
          </p>
        </div>
        {isEmpty || isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNewParentId(null);
                setIsAddOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Yeni Bölüm Ekle</span>
            </Button>
            {isEditing && (
              <Button
                size="sm"
                onClick={() => setIsEditing(false)}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                <span>Düzenlemeyi Bitir</span>
              </Button>
            )}
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => setIsEditing(true)}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            <span>Düzenle</span>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Outline Tree */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Bölüm İskeleti
            </h4>
            <span className="font-mono text-[10px] text-muted-foreground">
              {rootOutlines.length} Ana Bölüm
            </span>
          </div>

          <div className="space-y-2">
            {rootOutlines.map((root, idx) => {
              const subItems = getSubOutlines(root.id);
              const isSelected = selectedOutline?.id === root.id;
              const linkedCount = linkedBoxMap[root.id]?.length ?? 0;
              const pinnedCount = pinnedMap[root.id]?.length ?? 0;

              return (
                <div key={root.id} className="space-y-1.5">
                  <div
                    onClick={() => setSelectedOutline(root)}
                    className={`flex cursor-pointer items-start justify-between rounded-md border p-3 transition-all ${
                      isSelected
                        ? "border-primary/50 bg-primary/10 text-foreground font-semibold"
                        : "border-border/60 bg-card hover:border-border text-foreground hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 text-sm font-medium flex-1 pr-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-bold font-mono">
                        {idx + 1}
                      </span>
                      <div className="space-y-1">
                        <span className="font-serif text-sm font-semibold leading-snug block">
                          {root.title}
                        </span>
                        <div className="flex items-center gap-2 pt-0.5">
                          {linkedCount > 0 && (
                            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                              <FolderKanban className="h-3 w-3 text-primary" />
                              {linkedCount} kutu
                            </span>
                          )}
                          {pinnedCount > 0 && (
                            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                              <Quote className="h-3 w-3 text-primary" />
                              {pinnedCount} alıntı
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      {isEditing && !isIntroOrConclusion(root.title) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Sub Outlines */}
                  {subItems.length > 0 && (
                    <div className="ml-5 space-y-1.5 border-l-2 border-border/40 pl-3 pt-0.5">
                      {subItems.map((sub, subIdx) => {
                        const isSubSelected = selectedOutline?.id === sub.id;
                        return (
                          <div
                            key={sub.id}
                            onClick={() => setSelectedOutline(sub)}
                            className={`flex cursor-pointer items-center justify-between rounded-md border p-2.5 text-xs transition-all ${
                              isSubSelected
                                ? "border-primary/50 bg-primary/10 text-foreground font-semibold"
                                : "border-border/40 bg-card/60 hover:border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-primary/80">
                                {idx + 1}.{subIdx + 1}
                              </span>
                              <span className="font-sans font-medium text-foreground">
                                {sub.title}
                              </span>
                            </div>
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

        {/* Right Column: Active Section Details, Linked Boxes & Pinned Citations */}
        <div className="lg:col-span-7">
          {selectedOutline ? (
            <Card className="flex flex-col h-full border-border bg-card">
              <CardHeader className="border-b border-border/40 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <Badge
                      variant="outline"
                      className="border-primary/20 bg-primary/10 text-primary text-[11px] font-mono"
                    >
                      {selectedOutline.parentId ? "Alt Bölüm" : "Ana Bölüm"}
                    </Badge>
                    <CardTitle className="font-serif text-lg font-semibold text-foreground leading-snug">
                      {selectedOutline.title}
                    </CardTitle>
                    <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                      {selectedOutline.description ||
                        "Bu bölüm için henüz açıklama girilmemiş."}
                    </CardDescription>
                  </div>
                  {isEditing && (
                    <div className="flex items-center gap-1.5 shrink-0 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditTitle(selectedOutline.title);
                          setEditDescription(selectedOutline.description ?? "");
                          setIsEditOpen(true);
                        }}
                        className="gap-1 text-xs"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Düzenle</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteSection(selectedOutline.id)}
                        className="gap-1 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-5">
                {/* Linked Boxes */}
                <div className="space-y-3 rounded-md border border-border/40 bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <FolderKanban className="h-4 w-4 text-primary" />
                      <span>Beslendiği Konu Kutuları</span>
                    </h4>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {activeLinkedBoxIds.length} Bağlı Kutu
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="flex flex-wrap gap-2">
                      {boxesList.map((box) => {
                        const isLinked = activeLinkedBoxIds.includes(box.id);
                        return (
                          <Badge
                            key={box.id}
                            variant={isLinked ? "default" : "outline"}
                            className={`cursor-pointer text-xs py-1.5 px-3 transition-all max-w-full truncate ${
                              isLinked
                                ? "bg-primary text-primary-foreground border-transparent font-medium"
                                : "border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            }`}
                            onClick={() =>
                              handleToggleBoxLink(selectedOutline.id, box.id)
                            }
                          >
                            <span className="truncate">{box.title}</span>
                            <span className="ml-1 font-bold">
                              {isLinked ? "✓" : "+"}
                            </span>
                          </Badge>
                        );
                      })}
                    </div>
                  ) : activeLinkedBoxIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {boxesList
                        .filter((box) => activeLinkedBoxIds.includes(box.id))
                        .map((box) => (
                          <Badge
                            key={box.id}
                            variant="default"
                            className="bg-primary/10 text-primary border border-primary/20 text-xs py-1 px-2.5 font-medium flex items-center gap-1.5"
                          >
                            <FolderKanban className="h-3 w-3 shrink-0" />
                            <span className="truncate">{box.title}</span>
                          </Badge>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      Bu bölüme henüz konu kutusu bağlanmamış.
                      &quot;Düzenle&quot; moduna geçerek konu kutusu
                      bağlayabilirsiniz.
                    </p>
                  )}
                </div>

                {/* Pinned Citation Cards */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <h4 className="flex items-center gap-2 font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <Quote className="h-4 w-4 text-primary" />
                      <span>İğnelenmiş Alıntı Fişleri</span>
                    </h4>
                    <Badge
                      variant="secondary"
                      className="font-mono text-xs px-2 py-0.5"
                    >
                      {activePinnedAnnotationIds.length} Fiş
                    </Badge>
                  </div>

                  {annotationsList.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {annotationsList.map((anno) => {
                        const isPinned = activePinnedAnnotationIds.includes(
                          anno.id,
                        );
                        return (
                          <div
                            key={anno.id}
                            className={`rounded-md border p-3.5 space-y-2.5 text-xs transition-colors ${
                              isPinned
                                ? "border-primary/40 bg-primary/5"
                                : "border-border/60 bg-card hover:border-border"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-foreground flex items-center gap-2">
                                <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span>{anno.source?.title || "Kaynak"}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  (s. {anno.pageNumber})
                                </span>
                              </div>
                              {isEditing && (
                                <Button
                                  size="sm"
                                  variant={isPinned ? "default" : "secondary"}
                                  onClick={() =>
                                    handleTogglePin(selectedOutline.id, anno.id)
                                  }
                                  className="h-7 text-xs gap-1.5 px-2.5 shrink-0"
                                >
                                  {isPinned ? (
                                    <>
                                      <PinOff className="h-3 w-3" />
                                      <span>İğneyi Kaldır</span>
                                    </>
                                  ) : (
                                    <>
                                      <Pin className="h-3 w-3" />
                                      <span>Bölüme İğnele</span>
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                            <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground leading-relaxed text-xs">
                              &quot;{anno.content}&quot;
                            </blockquote>
                            {anno.comment && (
                              <div className="rounded-md bg-muted/50 p-2 text-xs text-foreground border border-border/40 font-sans">
                                💬 <strong>Not:</strong> {anno.comment}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground py-2">
                      Henüz kütüphaneden bir alıntı fişi oluşturulmamış.
                      Kütüphanedeki PDF okumalarınızdan oluşturduğunuz fişler
                      burada listelenecektir.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed border-border/40 bg-card min-h-[300px]">
              <BookOpen className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground font-medium">
                Detaylarını ve alıntı fişlerini görmek için soldan bir bölüm
                seçin.
              </p>
            </Card>
          )}
        </div>
      </div>

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
