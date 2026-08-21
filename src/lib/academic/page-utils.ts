/**
 * UI input domain: parses free-form user strings (e.g. "s. 15", "15-17", "Madde 4/b").
 * Do NOT merge with `src/core/services/pdf/page-format.ts` which formats numeric
 * chunk indices from the PDF parser — different input types and validation rules.
 *
 * Normalizes page number display with canonical academic prefixes ("s. X" for single page, "ss. X-Y" for ranges).
 *
 * @param raw - Raw page number string or user input.
 * @returns Canonical Turkish page number display string.
 */
export function formatPageNumber(raw: string | null | undefined): string {
  if (!raw) return "s. 1";
  const trimmed = raw.trim();
  if (!trimmed) return "s. 1";

  // Extract digits or digit groups
  const digits = trimmed.match(/\d+/g);
  if (!digits || digits.length === 0) {
    return trimmed; // fallback if non-numeric text like "Madde 4/b"
  }

  if (digits.length === 1) {
    return `s. ${digits[0]}`;
  }

  return `ss. ${digits[0]}-${digits[1]}`;
}

/**
 * Extracts raw page digits or range string (e.g., "15" or "15-17") from a formatted page string for editing.
 *
 * @param raw - Formatted or raw page number string.
 * @returns Clean numeric page input string.
 */
export function cleanPageNumberInput(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const digits = trimmed.match(/\d+/g);
  if (!digits || digits.length === 0) return trimmed;
  if (digits.length === 1) return digits[0];
  return `${digits[0]}-${digits[1]}`;
}
