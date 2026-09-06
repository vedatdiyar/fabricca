"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { PdfStatus } from "./pdf-dropzone";

export interface UsePdfDropzoneOptions {
  onFileSelect?: (file: File) => void;
  onUploadPdf?: (file: File) => Promise<boolean>;
  onUploadFiles?: (files: File[]) => Promise<void>;
  isSubmitting?: boolean;
  pdfStatus?: PdfStatus;
}

export function usePdfDropzone({
  onFileSelect,
  onUploadPdf,
  onUploadFiles,
  isSubmitting = false,
  pdfStatus = "NOT_UPLOADED",
}: UsePdfDropzoneOptions) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidPdf = (file: File): boolean => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error(
        `"${file.name}" atlandı: lütfen geçerli bir PDF dosyası yükleyiniz.`,
      );
      return false;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error(
        `"${file.name}" atlandı: PDF dosya boyutu maksimum 25MB olabilir.`,
      );
      return false;
    }
    return true;
  };

  /**
   * Handles one or more dropped/selected files with shared PDF validation.
   * Batch handler takes precedence; single-upload and controlled modes keep
   * their existing behavior for backward compatibility.
   */
  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const validFiles = files.filter(isValidPdf);
    if (validFiles.length === 0) return;

    if (onUploadFiles) {
      try {
        setIsUploading(true);
        await onUploadFiles(validFiles);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (onUploadPdf) {
      try {
        setIsUploading(true);
        for (const validFile of validFiles) {
          const ok = await onUploadPdf(validFile);
          if (ok) {
            toast.success(
              "PDF başarıyla yüklendi, metin ayrıştırıldı ve RAG için vektörleştirildi.",
            );
          }
        }
      } finally {
        setIsUploading(false);
      }
      return;
    }

    const first = validFiles[0];
    if (first) onFileSelect?.(first);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      void handleFiles(e.target.files);
    }
    // reset so same file can be re-selected
    if (e.target) e.target.value = "";
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const isProcessing =
    isSubmitting || isUploading || pdfStatus === "PROCESSING";

  return {
    isDragOver,
    setIsDragOver,
    isUploading,
    fileInputRef,
    isProcessing,
    handleDrop,
    handleInputChange,
    openFileDialog,
  };
}
