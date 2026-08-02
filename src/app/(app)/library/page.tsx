"use client";

import React, { useState, useEffect, Suspense, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BookMarked } from "lucide-react";
import { SidebarWorkList } from "./_components/sidebar-work-list";
import { ResourceDetail } from "./_components/resource-detail";
import { AddResourceModal } from "./_components/add-resource-modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { toast } from "sonner";
import { BOX_ORDER_WEIGHT } from "@/lib/box-constants";
import {
  getLibraryResourcesAction,
  deleteResourcePdfAction,
  createResourceNoteAction,
  deleteResourceNoteAction,
  toggleResourceReadStatusAction,
  deleteLibraryResourceAction,
  requestResourcePdfUploadAction,
  completeResourcePdfUploadAction,
  requestPdfCreateUploadAction,
  completePdfCreateUploadAction,
} from "./actions";
import type {
  LibraryResourceItem,
  LibraryResourceNote,
  ThesisBoxType,
  NoteType,
} from "./_types/types";

export default function LibraryPage() {
  return (
    <Suspense fallback={<LoadingSpinner variant="full" />}>
      <LibraryPageContent />
    </Suspense>
  );
}

function LibraryPageContent() {
  const searchParams = useSearchParams();
  const urlResourceId = searchParams.get("id");
  const initialSelectedId = urlResourceId ? parseInt(urlResourceId, 10) : null;

  const [resources, setResources] = useState<LibraryResourceItem[]>([]);
  const [notes, setNotes] = useState<LibraryResourceNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(
    initialSelectedId,
  );
  const [activeTab, setActiveTab] = useState<ThesisBoxType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const initialIdRef = useRef(initialSelectedId);

  const handleSelectResource = (id: number) => {
    setSelectedResourceId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", id.toString());
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleClearSelection = () => {
    setSelectedResourceId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);

        const res = await getLibraryResourcesAction();

        if (res.success && res.data && res.data.resources.length > 0) {
          setResources(res.data.resources);
          setNotes(res.data.notes);

          const currentId = initialIdRef.current;
          if (currentId) {
            const targetResource = res.data.resources.find(
              (r) => r.id === currentId,
            );
            if (targetResource) {
              setSelectedResourceId(targetResource.id);
            }
          }
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const selectedResource = resources.find(
    (item) => item.id === selectedResourceId,
  );

  const selectedResourceNotes = notes.filter(
    (note) => note.resourceId === selectedResourceId,
  );

  const sortedResources = useMemo(() => {
    return [...resources].sort((a, b) => {
      const aHasPdf = a.pdfStatus && a.pdfStatus !== "NOT_UPLOADED" ? 0 : 1;
      const bHasPdf = b.pdfStatus && b.pdfStatus !== "NOT_UPLOADED" ? 0 : 1;
      if (aHasPdf !== bHasPdf) return aHasPdf - bHasPdf;
      const orderA = BOX_ORDER_WEIGHT[a.boxType] ?? 99;
      const orderB = BOX_ORDER_WEIGHT[b.boxType] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [resources]);

  const handleCreateResourceFromPdf = async (
    file: File,
    boxId: number,
  ): Promise<boolean> => {
    try {
      const requestRes = await requestPdfCreateUploadAction();
      if (!requestRes.success) {
        toast.error(requestRes.error || "Yükleme bağlantısı oluşturulamadı.");
        return false;
      }

      let uploadRes: Response;
      try {
        uploadRes = await fetch(requestRes.presignedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": "application/pdf" },
        });
      } catch {
        toast.error(
          "PDF buluta gönderilirken ağ hatası oluştu. Tarayıcı konsoluna bakınız.",
        );
        return false;
      }
      if (!uploadRes.ok) {
        toast.error("PDF dosyası bulut depolamaya yüklenirken hata oluştu.");
        return false;
      }

      const completeRes = await completePdfCreateUploadAction(
        requestRes.tempKey,
        file.name,
        boxId,
      );
      if (!completeRes.success) {
        toast.error(
          completeRes.error || "Eser PDF'den yüklenirken hata oluştu.",
        );
        return false;
      }
      setResources((prev) => [completeRes.data, ...prev]);
      handleSelectResource(completeRes.data.id);
      return true;
    } catch {
      toast.error("PDF yükleme sırasında beklenmeyen bir hata oluştu.");
      return false;
    }
  };

  const handleUploadPdf = async (file: File): Promise<boolean> => {
    if (!selectedResourceId) return false;

    try {
      const requestRes =
        await requestResourcePdfUploadAction(selectedResourceId);
      if (!requestRes.success) {
        toast.error(requestRes.error || "Yükleme bağlantısı oluşturulamadı.");
        return false;
      }

      const uploadRes = await fetch(requestRes.presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!uploadRes.ok) {
        const uploadErrorText = await uploadRes.text().catch(() => "unknown");
        console.error(
          "[handleUploadPdf] R2 presigned PUT failed:",
          uploadRes.status,
          uploadErrorText,
        );
        toast.error("PDF dosyası bulut depolamaya yüklenirken hata oluştu.");
        return false;
      }

      const completeRes = await completeResourcePdfUploadAction(
        selectedResourceId,
        requestRes.tempKey,
        file.name,
      );
      if (!completeRes.success) {
        toast.error(completeRes.error || "PDF yüklenirken hata oluştu.");
        return false;
      }
      setResources((prev) =>
        prev.map((item) =>
          item.id === selectedResourceId
            ? { ...item, ...completeRes.data }
            : item,
        ),
      );
      return true;
    } catch {
      toast.error("PDF yükleme sırasında beklenmeyen bir hata oluştu.");
      return false;
    }
  };

  const handleDeletePdf = async (resourceId: number) => {
    const res = await deleteResourcePdfAction(resourceId);
    if (res.success) {
      setResources((prev) =>
        prev.map((item) =>
          item.id === resourceId
            ? {
                ...item,
                pdfUrl: undefined,
                pdfFileName: undefined,
                pdfStatus: "NOT_UPLOADED" as const,
              }
            : item,
        ),
      );
      setNotes((prev) => prev.filter((n) => n.resourceId !== resourceId));
      toast.success("PDF ve ilişkili tüm veriler temizlendi.");
    } else {
      toast.error(res.error || "PDF silinirken hata oluştu.");
    }
  };

  const handleAddNote = async (input: {
    pageNumber: string;
    noteType: NoteType;
    content: string;
  }) => {
    if (!selectedResourceId) return;

    const res = await createResourceNoteAction({
      resourceId: selectedResourceId,
      ...input,
    });

    if (res.success && res.data) {
      setNotes((prev) => [res.data, ...prev]);
      toast.success("Not ve alıntı fişi kaydedildi.");
    } else {
      toast.error(res.error || "Not kaydedilirken hata oluştu.");
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    const res = await deleteResourceNoteAction(noteId);
    if (res.success) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Not silindi.");
    } else {
      toast.error(res.error || "Not silinirken hata oluştu.");
    }
  };

  const handleDeleteResource = async (resourceId: number) => {
    const res = await deleteLibraryResourceAction(resourceId);
    if (res.success) {
      setResources((prev) => prev.filter((r) => r.id !== resourceId));

      if (selectedResourceId === resourceId) {
        handleClearSelection();
      }

      toast.success("Eser ve tüm ilişkili veriler kalıcı olarak silindi.");
    } else {
      toast.error(res.error || "Eser silinirken bir hata oluştu.");
    }
  };

  const handleToggleReadStatus = async (resourceId: number) => {
    const target = resources.find((r) => r.id === resourceId);
    if (!target) return;

    const nextStatus = !target.isRead;
    const res = await toggleResourceReadStatusAction(resourceId);

    if (res.success) {
      setResources((prev) =>
        prev.map((item) =>
          item.id === resourceId ? { ...item, isRead: nextStatus } : item,
        ),
      );
      toast.success(
        nextStatus
          ? "Eser 'Okundu' olarak işaretlendi."
          : "Eser 'Okunacak' olarak işaretlendi.",
      );
    } else {
      toast.error(res.error || "Okuma durumu güncellenemedi.");
    }
  };

  const handleUpdateResource = (updatedResource: LibraryResourceItem) => {
    setResources((prev) =>
      prev.map((item) =>
        item.id === updatedResource.id ? updatedResource : item,
      ),
    );
  };

  if (isLoading) {
    return <LoadingSpinner variant="full" />;
  }

  return (
    <div className="flex flex-col w-full space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
        <div className="lg:col-span-4 lg:sticky lg:top-[calc(7rem+1px)] lg:h-[calc(100vh-8.5rem-1px)] flex flex-col min-h-0">
          <SidebarWorkList
            resources={sortedResources}
            selectedResourceId={selectedResourceId}
            onSelectResource={(id) => handleSelectResource(id)}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
            searchQuery={searchQuery}
            onSearchChange={(q) => setSearchQuery(q)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onDeleteResource={handleDeleteResource}
          />
        </div>

        <div className="lg:col-span-8 h-full min-h-0">
          {selectedResource ? (
            <ResourceDetail
              resource={selectedResource}
              notes={selectedResourceNotes}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onToggleReadStatus={handleToggleReadStatus}
              onUpdateResource={handleUpdateResource}
              onUploadPdf={handleUploadPdf}
              onDeletePdf={handleDeletePdf}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full rounded-md border border-border bg-card p-8 text-center text-muted-foreground">
              <BookMarked className="h-10 w-10 opacity-30 mb-3" />
              <h3 className="font-serif text-lg font-medium text-foreground">
                Eser Seçilmedi
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Detayları ve akademik notları görüntülemek için sol menüden bir
                eser seçiniz.
              </p>
            </div>
          )}
        </div>
      </div>

      <AddResourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmitPdf={handleCreateResourceFromPdf}
      />
    </div>
  );
}
