"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { BookMarked } from "lucide-react";
import { SidebarWorkList } from "./_components/sidebar-work-list";
import { ResourceDetail } from "./_components/resource-detail";
import { AddResourceModal } from "./_components/add-resource-modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { toast } from "sonner";
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

/**
 * Digital Library Page component.
 * Manages database-backed academic literature resources, PDF uploads, RAG vectorization,
 * note taking, and Kartoteks card index integration.
 */
function LibraryPageContent() {
  const searchParams = useSearchParams();
  const urlResourceId = searchParams.get("id");
  const initialSelectedId = urlResourceId ? parseInt(urlResourceId, 10) : null;

  const [resources, setResources] = useState<LibraryResourceItem[]>([]);
  const [notes, setNotes] = useState<LibraryResourceNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active selection & filter state — initialized from URL query param (?id=...)
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(
    initialSelectedId,
  );
  const [activeTab, setActiveTab] = useState<ThesisBoxType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Add Resource Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Stable ref for the initial URL-derived ID; used inside useEffect without deps
  const initialIdRef = useRef(initialSelectedId);

  /**
   * Selects a resource and synchronizes the active selection with URL query params (?id=...).
   */
  const handleSelectResource = (id: number) => {
    setSelectedResourceId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", id.toString());
      window.history.replaceState({}, "", url.toString());
    }
  };

  /**
   * Clears the active selection and removes the ?id= query param from the URL.
   * Used after deleting the currently selected resource.
   */
  const handleClearSelection = () => {
    setSelectedResourceId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Load resources & notes from Neon PostgreSQL DB on mount
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);

        const res = await getLibraryResourcesAction();

        if (res.success && res.data && res.data.resources.length > 0) {
          setResources(res.data.resources);
          setNotes(res.data.notes);

          // Select resource from URL param if present; otherwise show empty state
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
        // DB not reachable — leave empty state
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Get currently selected resource object
  const selectedResource = resources.find(
    (item) => item.id === selectedResourceId,
  );

  // Get notes for currently selected resource
  const selectedResourceNotes = notes.filter(
    (note) => note.resourceId === selectedResourceId,
  );

  // Sort resources: PDF uploaded first → subjectProblem → theoreticalFramework → methodology → primaryMaterial → createdAt
  const BOX_SORT_ORDER: Record<string, number> = {
    SUBJECT_PROBLEM: 0,
    THEORETICAL_FRAMEWORK: 1,
    METHODOLOGY: 2,
    PRIMARY_MATERIAL: 3,
  };
  const sortedResources = [...resources].sort((a, b) => {
    const aHasPdf = a.pdfStatus && a.pdfStatus !== "NOT_UPLOADED" ? 0 : 1;
    const bHasPdf = b.pdfStatus && b.pdfStatus !== "NOT_UPLOADED" ? 0 : 1;
    if (aHasPdf !== bHasPdf) return aHasPdf - bHasPdf;
    const orderA = BOX_SORT_ORDER[a.boxType] ?? 99;
    const orderB = BOX_SORT_ORDER[b.boxType] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  /**
   * Handles creating a new resource via PDF upload with metadata extraction.
   * Uses presigned URL flow to bypass Vercel's 4.5MB serverless body limit.
   */
  const handleCreateResourceFromPdf = async (file: File, boxId: number) => {
    try {
      // Step 1: Get presigned upload URL
      const requestRes = await requestPdfCreateUploadAction();
      if (!requestRes.success) {
        toast.error(requestRes.error || "Yükleme bağlantısı oluşturulamadı.");
        return;
      }

      // Step 2: Upload PDF directly to R2 from browser
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
        return;
      }
      if (!uploadRes.ok) {
        toast.error("PDF dosyası bulut depolamaya yüklenirken hata oluştu.");
        return;
      }

      // Step 3: Complete the upload — fetch from R2, extract metadata, create resource, run pipeline
      const completeRes = await completePdfCreateUploadAction(
        requestRes.tempKey,
        file.name,
        boxId,
      );
      if (!completeRes.success) {
        toast.error(
          completeRes.error || "Eser PDF'den yüklenirken hata oluştu.",
        );
        throw new Error(completeRes.error);
      }
      setResources((prev) => [completeRes.data, ...prev]);
      handleSelectResource(completeRes.data.id);
    } catch (err) {
      throw err;
    }
  };

  /**
   * Handles PDF upload and RAG vectorization for selected resource.
   * Uses presigned URL flow to bypass Vercel's 4.5MB serverless body limit.
   */
  const handleUploadPdf = async (file: File) => {
    if (!selectedResourceId) return;

    // Step 1: Get presigned upload URL
    const requestRes = await requestResourcePdfUploadAction(selectedResourceId);
    if (!requestRes.success) {
      toast.error(requestRes.error || "Yükleme bağlantısı oluşturulamadı.");
      return;
    }

    // Step 2: Upload PDF directly to R2 from browser
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
      return;
    }

    // Step 3: Complete the upload — fetch from R2, extract metadata, run pipeline
    const completeRes = await completeResourcePdfUploadAction(
      selectedResourceId,
      requestRes.tempKey,
      file.name,
    );
    if (!completeRes.success) {
      toast.error(completeRes.error || "PDF yüklenirken hata oluştu.");
      throw new Error(completeRes.error);
    }
    setResources((prev) =>
      prev.map((item) =>
        item.id === selectedResourceId
          ? { ...item, ...completeRes.data }
          : item,
      ),
    );
  };

  /**
   * Handles deleting PDF file for selected resource.
   */
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

  /**
   * Handles adding a new note linked to selected resource.
   */
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
      toast.success("Not ve kartoteks fişi kaydedildi.");
    } else {
      toast.error(res.error || "Not kaydedilirken hata oluştu.");
    }
  };

  /**
   * Handles deleting a note.
   */
  const handleDeleteNote = async (noteId: number) => {
    const res = await deleteResourceNoteAction(noteId);
    if (res.success) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Not silindi.");
    } else {
      toast.error(res.error || "Not silinirken hata oluştu.");
    }
  };

  /**
   * Handles permanently deleting a library resource and all its related data.
   */
  const handleDeleteResource = async (resourceId: number) => {
    const res = await deleteLibraryResourceAction(resourceId);
    if (res.success) {
      setResources((prev) => prev.filter((r) => r.id !== resourceId));

      // If the deleted resource was selected, clear the selection and remove the URL id param
      if (selectedResourceId === resourceId) {
        handleClearSelection();
      }

      toast.success("Eser ve tüm ilişkili veriler kalıcı olarak silindi.");
    } else {
      toast.error(res.error || "Eser silinirken bir hata oluştu.");
    }
  };

  /**
   * Handles toggling read status for selected resource.
   */
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
    } else {
      toast.error(res.error || "Okuma durumu güncellenemedi.");
    }
  };

  /**
   * Handles updating resource metadata in local state.
   */
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
        {/* Left Column: Sidebar Work List (4/12) */}
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

        {/* Right Column: Resource Detail & Note Taking (8/12) */}
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

      {/* Add Resource Modal */}
      <AddResourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmitPdf={handleCreateResourceFromPdf}
      />
    </div>
  );
}
