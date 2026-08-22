"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookMarked } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SidebarWorkList } from "./_components/sidebar-work-list";
import { ResourceDetail } from "./_components/resource-detail";
import { AddResourceModal } from "./_components/add-resource-modal";
import { LibrarySkeleton } from "./_components/library-skeleton";
import { useLibraryResources } from "./_hooks/use-library-resources";
import { usePdfUpload } from "./_hooks/use-pdf-upload";
import { useResourceNotes } from "./_hooks/use-resource-notes";
import { useResourceCritique } from "./_hooks/use-resource-critique";

/**
 * Library page with a sidebar work list and a resource detail panel.
 *
 * @returns The library page markup.
 */
export default function LibraryPage() {
  return (
    <Suspense fallback={<LibrarySkeleton />}>
      <LibraryPageContent />
    </Suspense>
  );
}

/**
 * Library page content composing resource, PDF, and note hooks.
 *
 * @returns The library page content markup.
 */
function LibraryPageContent() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const searchParams = useSearchParams();
  const urlResourceId = searchParams.get("id");
  const initialSelectedId = urlResourceId ? parseInt(urlResourceId, 10) : null;

  const {
    resources,
    setResources,
    isLoading,
    selectedResourceId,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    sortedResources,
    handleSelectResource,
    handleDeleteResource,
    handleToggleReadStatus,
    handleUpdateResource,
  } = useLibraryResources(initialSelectedId);

  const { notes, setNotes, handleAddNote, handleUpdateNote, handleDeleteNote } =
    useResourceNotes({ selectedResourceId });

  const {
    getCritiqueFor,
    handleSaveCritique,
    handleEvaluateCritique,
    isEvaluating,
  } = useResourceCritique({
    selectedResourceId,
  });

  const { handleCreateResourceFromPdf, handleUploadPdf, handleDeletePdf } =
    usePdfUpload({
      selectedResourceId,
      setResources,
      setNotes,
      handleSelectResource,
    });

  const selectedResource = resources.find(
    (item) => item.id === selectedResourceId,
  );

  const selectedResourceNotes = notes.filter(
    (note) => note.resourceId === selectedResourceId,
  );

  const selectedCritique = getCritiqueFor(selectedResourceId);

  const onSelectAndOpenDetail = (id: number) => {
    handleSelectResource(id);
    setMobileView("detail");
  };

  if (isLoading) {
    return <LibrarySkeleton />;
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Mobile Master-Detail View Switcher (Visible only below lg) */}
      <div className="flex items-center justify-between lg:hidden pb-1">
        <div className="flex items-center rounded-lg border border-border bg-card p-1 text-xs w-full">
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all ${
              mobileView === "list"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Eser Listesi ({sortedResources.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileView("detail")}
            disabled={!selectedResource}
            className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all ${
              mobileView === "detail"
                ? "bg-primary text-primary-foreground shadow-xs"
                : !selectedResource
                  ? "opacity-40 cursor-not-allowed text-muted-foreground"
                  : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Eser Detayı & Notlar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
        {/* Left Column: Sidebar Work List */}
        <div
          className={`lg:col-span-4 lg:sticky lg:top-[calc(7rem+1px)] lg:h-[calc(100vh-8.5rem-1px)] flex flex-col min-h-0 ${
            mobileView === "list" ? "block" : "hidden lg:flex"
          }`}
        >
          <SidebarWorkList
            resources={sortedResources}
            selectedResourceId={selectedResourceId}
            onSelectResource={onSelectAndOpenDetail}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
            searchQuery={searchQuery}
            onSearchChange={(q) => setSearchQuery(q)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onDeleteResource={handleDeleteResource}
          />
        </div>

        {/* Right Column: Resource Detail */}
        <div
          className={`lg:col-span-8 h-full min-h-0 ${
            mobileView === "detail" ? "block" : "hidden lg:block"
          }`}
        >
          {/* Back Button on Mobile */}
          {selectedResource && (
            <div className="lg:hidden mb-3">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="text-xs text-primary font-medium flex items-center gap-1.5 py-1 px-2.5 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20"
              >
                ← Eser Listesine Dön
              </button>
            </div>
          )}

          {selectedResource ? (
            <ResourceDetail
              resource={selectedResource}
              notes={selectedResourceNotes}
              critique={selectedCritique}
              onAddNote={handleAddNote}
              onUpdateNote={handleUpdateNote}
              onSaveCritique={handleSaveCritique}
              onEvaluateCritique={handleEvaluateCritique}
              isEvaluating={isEvaluating}
              onDeleteNote={handleDeleteNote}
              onToggleReadStatus={handleToggleReadStatus}
              onUpdateResource={handleUpdateResource}
              onUploadPdf={handleUploadPdf}
              onDeletePdf={handleDeletePdf}
            />
          ) : (
            <Card className="flex flex-col items-center justify-center h-full rounded-md border border-border p-8 text-center text-muted-foreground">
              <BookMarked className="h-10 w-10 opacity-30 mb-3" />
              <h3 className="font-serif text-lg font-medium text-foreground">
                Eser Seçilmedi
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Detayları ve akademik notları görüntülemek için sol menüden bir
                eser seçiniz.
              </p>
            </Card>
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
