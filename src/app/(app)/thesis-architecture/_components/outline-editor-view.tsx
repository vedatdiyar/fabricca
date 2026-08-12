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
} from "lucide-react";

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

  // Add new section state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newParentId, setNewParentId] = useState<number | null>(null);

  // Edit section state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-sans text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Tez İçindekiler & Bölüm Planı
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bölüm planınızı yapılandırın, bölümlere Konu Kutuları bağlayın ve
            Alıntı Fişlerini (`citation-cards`) kanıt olarak bölümlere
            iğneleyin.
          </p>
        </div>
        <Button
          onClick={() => {
            setNewParentId(null);
            setIsAddOpen(true);
          }}
          className="gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Yeni Bölüm Ekle</span>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Outline Tree */}
        <div className="space-y-3 lg:col-span-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bölüm İskeleti
          </div>

          <div className="space-y-2">
            {rootOutlines.map((root, idx) => {
              const subItems = getSubOutlines(root.id);
              const isSelected = selectedOutline?.id === root.id;

              return (
                <div key={root.id} className="space-y-1">
                  <div
                    onClick={() => setSelectedOutline(root)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 text-primary shadow-xs"
                        : "border-border/60 bg-card hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 font-medium text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span>{root.title}</span>
                    </div>

                    <div className="flex items-center gap-1">
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
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Sub Outlines */}
                  {subItems.length > 0 && (
                    <div className="ml-6 space-y-1 border-l-2 border-border/40 pl-3 pt-1">
                      {subItems.map((sub, subIdx) => {
                        const isSubSelected = selectedOutline?.id === sub.id;
                        return (
                          <div
                            key={sub.id}
                            onClick={() => setSelectedOutline(sub)}
                            className={`flex cursor-pointer items-center justify-between rounded-md border p-2.5 text-xs transition-all ${
                              isSubSelected
                                ? "border-primary bg-primary/5 text-primary font-medium"
                                : "border-border/40 bg-card/60 hover:border-border"
                            }`}
                          >
                            <span>
                              {idx + 1}.{subIdx + 1} {sub.title}
                            </span>
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
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-bold">
                      {selectedOutline.title}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs leading-relaxed">
                      {selectedOutline.description ||
                        "Bu bölüm için henüz açıklama girilmemiş."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
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
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-0">
                {/* Linked Boxes */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <FolderKanban className="h-4 w-4 text-primary" />
                    <span>Beslendiği Konu Kutuları</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {boxesList.map((box) => {
                      const isLinked = activeLinkedBoxIds.includes(box.id);
                      return (
                        <Badge
                          key={box.id}
                          variant={isLinked ? "default" : "outline"}
                          className="cursor-pointer text-xs py-1 px-2.5 transition-all"
                          onClick={() =>
                            handleToggleBoxLink(selectedOutline.id, box.id)
                          }
                        >
                          {box.title} {isLinked ? "✓" : "+"}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Pinned Citation Cards */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Quote className="h-4 w-4 text-primary" />
                      <span>
                        İğnelenmiş Alıntı Fişleri (
                        {activePinnedAnnotationIds.length})
                      </span>
                    </div>
                  </div>

                  {annotationsList.length > 0 ? (
                    <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                      {annotationsList.map((anno) => {
                        const isPinned = activePinnedAnnotationIds.includes(
                          anno.id,
                        );
                        return (
                          <div
                            key={anno.id}
                            className={`rounded-lg border p-3 space-y-2 text-xs transition-all ${
                              isPinned
                                ? "border-primary/50 bg-primary/5"
                                : "border-border/40 bg-card hover:border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-foreground">
                                {anno.source?.title || "Kaynak"} (s.{" "}
                                {anno.pageNumber})
                              </div>
                              <Button
                                size="sm"
                                variant={isPinned ? "default" : "secondary"}
                                onClick={() =>
                                  handleTogglePin(selectedOutline.id, anno.id)
                                }
                                className="h-7 text-xs gap-1 px-2 shrink-0"
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
                            </div>
                            <p className="italic text-muted-foreground line-clamp-3">
                              &quot;{anno.content}&quot;
                            </p>
                            {anno.comment && (
                              <div className="rounded bg-muted/50 p-1.5 text-[11px] text-foreground/80">
                                💬 <strong>Not:</strong> {anno.comment}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      Henüz kütüphaneden bir alıntı fişi oluşturulmamış.
                      Kütüphanedeki PDF okumalarınızdan oluşturduğunuz fişler
                      burada listelenecektir.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed">
              <BookOpen className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
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
            <DialogTitle>Yeni Tez Bölümü Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold">Bölüm Başlığı</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Örn: 1991-1995 Talep İçeriğinin İlk Dönüşümü"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">
                Yazım Kapsamı & Açıklama
              </label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={4}
                placeholder="Bu bölümde ele alınacak ana tartışma ve odak..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateSection}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Section */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bölümü Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold">Bölüm Başlığı</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">
                Yazım Kapsamı & Açıklama
              </label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleUpdateSection}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
