import { ThesisBoxType } from "@/lib/box-constants";

/** Options passed to the academic author formatter. */
export interface FormatAuthorOptions {
  /** Array of individual author names if available. */
  authors?: string[] | null;
  /** Corporate publisher, archive, or institution name if available. */
  publisher?: string | null;
  /** Thesis box type context (e.g. PRIMARY_MATERIAL, THEORETICAL_FRAMEWORK). */
  boxType?: ThesisBoxType | string | null;
}

/**
 * Formats a resource's author array into a domain-aware list of creators based on box type and publisher.
 *
 * @param options - Source metadata including authors, publisher, and box type.
 * @returns Array of formatted author/creator names suitable for academic display.
 */
export function formatResourceAuthors(options: FormatAuthorOptions): string[] {
  const { authors, publisher, boxType } = options;

  // Filter out invalid/empty author entries
  const validAuthors = Array.isArray(authors)
    ? authors.filter((a) => a && a.trim().length > 0)
    : [];

  if (validAuthors.length > 0) {
    return validAuthors;
  }

  const cleanPublisher =
    publisher &&
    publisher.trim() !== "" &&
    publisher.trim() !== "Belirtilmemiş" &&
    publisher.trim() !== "Unknown"
      ? publisher.trim()
      : null;

  const isPrimary = boxType === "PRIMARY_MATERIAL";

  if (isPrimary) {
    if (cleanPublisher) {
      return [cleanPublisher];
    }
    return ["Arşiv / Birincil Belge"];
  }

  if (cleanPublisher) {
    return [cleanPublisher];
  }

  return ["Yazar Belirtilmemiş"];
}

/**
 * Formats resource authors into a single comma-separated display string.
 *
 * @param options - Source metadata including authors, publisher, and box type.
 * @returns Single formatted creator display string.
 */
export function formatAuthorDisplayString(
  options: FormatAuthorOptions,
): string {
  const formatted = formatResourceAuthors(options);
  if (formatted.length <= 3) {
    return formatted.join(", ");
  }
  return `${formatted.slice(0, 3).join(", ")} ve diğerleri`;
}
