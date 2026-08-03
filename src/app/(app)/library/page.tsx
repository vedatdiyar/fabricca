"use client";

import React, { useState, Suspense } from "react";
import { BookMarked } from "lucide-react";
import { SidebarWorkList } from "./_components/sidebar-work-list";
import { ResourceDetail } from "./_components/resource-detail";
import { AddResourceModal } from "./_components/add-resource-modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useLibraryResources } from "./_hooks/use-library-resources";
import { usePdfUpload } from "./_hooks/use-pdf-upload";
import { useResourceNotes } from "./_hooks/use-resource-notes";

/**
 * Library page with a sidebar work list and a resource detail panel.
 *
 * @returns The library page markup.
 */
export default function LibraryPage() {
  return (
    <Suspense fallback={<LoadingSpinner variant="full" />}>
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
  } = useLibraryResources();

  const { notes, setNotes, handleAddNote, handleDeleteNote } = useResourceNotes(
    { selectedResourceId },
  );

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
