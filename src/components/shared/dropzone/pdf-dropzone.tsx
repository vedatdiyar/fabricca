"use client";

import * as React from "react";
import { usePdfDropzone } from "./use-pdf-dropzone";
import { HeroDropzone } from "./hero-dropzone";
import { CompactDropzone } from "./compact-dropzone";

export type PdfStatus = "NOT_UPLOADED" | "PROCESSING" | "READY" | "FAILED";

export interface UnifiedPdfDropzoneProps {
  // Compact / controlled mode (legacy pdf-dropzone)
  selectedFile?: File | null;
  onFileSelect?: (file: File) => void;
  isSubmitting?: boolean;
  statusMessage?: string;
  // Hero / self-managed upload mode (legacy pdf-upload-dropzone)
  resourceTitle?: string;
  pdfStatus?: PdfStatus;
  onUploadPdf?: (file: File) => Promise<boolean>;
  // Multi-file batch mode (primary-material collections)
  multiple?: boolean;
  onUploadFiles?: (files: File[]) => Promise<void>;
  className?: string;
  variant?: "compact" | "hero";
}

/**
 * Unified PDF dropzone supporting both compact (controlled) and hero (self-managed)
 * layouts. Consolidates drag-over handling, file validation and shared Tailwind styling.
 *
 * @param props - Unified dropzone props.
 * @returns Dropzone markup.
 */
export function UnifiedPdfDropzone({
  selectedFile = null,
  onFileSelect,
  isSubmitting = false,
  statusMessage = "",
  resourceTitle = "",
  pdfStatus = "NOT_UPLOADED",
  onUploadPdf,
  multiple = false,
  onUploadFiles,
  className,
  variant,
}: UnifiedPdfDropzoneProps) {
  const resolvedVariant: "compact" | "hero" =
    variant ??
    (onUploadPdf || onUploadFiles || resourceTitle ? "hero" : "compact");

  const {
    isDragOver,
    setIsDragOver,
    fileInputRef,
    isProcessing,
    handleDrop,
    handleInputChange,
    openFileDialog,
  } = usePdfDropzone({
    onFileSelect,
    onUploadPdf,
    onUploadFiles,
    isSubmitting,
    pdfStatus,
  });

  if (resolvedVariant === "hero") {
    return (
      <HeroDropzone
        fileInputRef={fileInputRef}
        isDragOver={isDragOver}
        setIsDragOver={setIsDragOver}
        isProcessing={isProcessing}
        multiple={multiple}
        pdfStatus={pdfStatus}
        resourceTitle={resourceTitle}
        className={className}
        onDrop={handleDrop}
        onInputChange={handleInputChange}
        onOpenFile={openFileDialog}
      />
    );
  }

  return (
    <CompactDropzone
      fileInputRef={fileInputRef}
      isDragOver={isDragOver}
      setIsDragOver={setIsDragOver}
      isProcessing={isProcessing}
      multiple={multiple}
      selectedFile={selectedFile}
      statusMessage={statusMessage}
      className={className}
      onDrop={handleDrop}
      onInputChange={handleInputChange}
      onOpenFile={openFileDialog}
    />
  );
}

// Back-compat named exports for direct migration
export type PdfDropzoneProps = UnifiedPdfDropzoneProps;
export type PdfUploadDropzoneProps = UnifiedPdfDropzoneProps;
