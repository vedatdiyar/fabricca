"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  completePdfCreateUploadAction,
  requestPdfCreateUploadAction,
} from "@/app/(app)/library/pdf-actions";

/** Result shape returned by the primary-material upload hook. */
export interface UsePrimaryMaterialUploadResult {
  /** True while at least one PDF is being uploaded and processed. */
  isUploading: boolean;
  /** Turkish progress message (e.g. "2/5 yükleniyor...") shown under the dropzone. */
  statusMessage: string;
  /** Uploads the given PDF files sequentially into the target box. */
  uploadFiles: (files: File[]) => Promise<void>;
}

/**
 * Uploads primary-material PDFs directly into a thesis box using the shared
 * library pipeline (presigned R2 PUT + metadata extraction + RAG indexing),
 * then refreshes the literature pool so new documents render as standard
 * article cards alongside OpenAlex results.
 *
 * @param thesisBoxId - Target thesis box database ID (child collection preferred).
 * @returns Upload state and the batch upload handler.
 */
export function usePrimaryMaterialUpload(
  thesisBoxId: number | undefined,
): UsePrimaryMaterialUploadResult {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (!thesisBoxId) {
        toast.error("Konu kutusu bulunamadı. Sayfayı yenileyip tekrar deneyin.");
        return;
      }
      if (isUploading) return;
      setIsUploading(true);
      let successCount = 0;
      const failedNames: string[] = [];
      try {
        for (let index = 0; index < files.length; index++) {
          const file = files[index]!;
          setStatusMessage(
            files.length > 1
              ? `${index + 1}/${files.length} yükleniyor: ${file.name}`
              : `${file.name} yükleniyor...`,
          );
          try {
            const requestRes = await requestPdfCreateUploadAction();
            if (!requestRes.success) {
              failedNames.push(file.name);
              continue;
            }
            const uploadStartedAt = Date.now();
            let uploadRes: Response;
            try {
              uploadRes = await fetch(requestRes.presignedUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": "application/pdf" },
              });
            } catch {
              failedNames.push(file.name);
              continue;
            }
            if (!uploadRes.ok) {
              failedNames.push(file.name);
              continue;
            }
            const completeRes = await completePdfCreateUploadAction(
              requestRes.tempKey,
              file.name,
              thesisBoxId,
              requestRes.flowId,
              uploadStartedAt,
            );
            if (!completeRes.success) {
              toast.error(completeRes.error || `"${file.name}" yüklenemedi.`);
              failedNames.push(file.name);
              continue;
            }
            successCount++;
          } catch {
            failedNames.push(file.name);
          }
        }
      } finally {
        setIsUploading(false);
        setStatusMessage("");
      }

      if (successCount > 0) {
        await queryClient.invalidateQueries({ queryKey: ["literature-pool"] });
        toast.success(
          successCount === 1
            ? "Belge yüklendi ve kaynaklara eklendi."
            : `${successCount} belge yüklendi ve kaynaklara eklendi.`,
        );
      }
      if (failedNames.length > 0 && successCount === 0) {
        toast.error(
          failedNames.length === 1
            ? `"${failedNames[0]}" yüklenirken hata oluştu.`
            : `${failedNames.length} belge yüklenemedi. Lütfen tekrar deneyin.`,
        );
      }
    },
    [isUploading, queryClient, thesisBoxId],
  );

  return { isUploading, statusMessage, uploadFiles };
}
