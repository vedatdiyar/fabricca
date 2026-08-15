"use client";

import { toast } from "sonner";

/**
 * Counts the words of a raw academic text using whitespace splitting.
 *
 * @param text - The raw input text.
 * @returns The number of words; 0 for empty or whitespace-only input.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Splits a raw text into trimmed, non-empty paragraphs for clean reading.
 *
 * @param text - The raw input text.
 * @returns The list of non-empty trimmed paragraphs.
 */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Copies a text value to the clipboard and surfaces a toast notification.
 * Notifies the user when there is nothing to copy.
 *
 * @param text - The text value to copy.
 * @param title - The academic column title used in the toast message.
 */
export function copyToClipboard(text: string, title: string): void {
  if (!text.trim()) {
    toast.error("Kopyalanacak metin bulunmuyor.");
    return;
  }
  void navigator.clipboard.writeText(text);
  toast.success(`"${title}" metni panoya kopyalandı.`);
}
