"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  deleteResourcePdfAction,
  requestResourcePdfUploadAction,
  completeResourcePdfUploadAction,
  requestPdfCreateUploadAction,
  completePdfCreateUploadAction,
} from "../actions";
import type { LibraryResourceItem, LibraryResourceNote } from "../_types/types";

interface UsePdfUploadParams {
  selectedResourceId: number | null;
  setResources: React.Dispatch<React.SetStateAction<LibraryResourceItem[]>>;
  setNotes: React.Dispatch<React.SetStateAction<LibraryResourceNote[]>>;
  handleSelectResource: (id: number) => void;
}

/**
 * Handles all PDF upload and deletion operations for library resources.
 *
 * @param params - Resource state setters and selection handler from parent hooks.
 * @param params.selectedResourceId - The currently selected resource ID.
 * @param params.setResources - State setter for the resources list.
 * @param params.setNotes - State setter for the notes list.
 * @param params.handleSelectResource - Handler to select a resource by ID.
 * @returns PDF upload and deletion handlers.
 */
export function usePdfUpload({
  selectedResourceId,
  setResources,
  setNotes,
  handleSelectResource,
}: UsePdfUploadParams) {
  const handleCreateResourceFromPdf = useCallback(
    async (file: File, boxId: number): Promise<boolean> => {
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
    },
    [setResources, handleSelectResource],
  );

  const handleUploadPdf = useCallback(
    async (file: File): Promise<boolean> => {
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
    },
    [selectedResourceId, setResources],
  );

  const handleDeletePdf = useCallback(
    async (resourceId: number) => {
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
    },
    [setResources, setNotes],
  );

  return {
    handleCreateResourceFromPdf,
    handleUploadPdf,
    handleDeletePdf,
  };
}
