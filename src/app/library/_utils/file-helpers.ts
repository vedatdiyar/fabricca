/**
 * Sanitizes a filename by replacing Turkish characters and non-alphanumeric chars
 * to prevent encoding and URL issues.
 */
export function sanitizeFileName(fileName: string): string {
  const map: Record<string, string> = {
    ç: "c",
    Ç: "C",
    ğ: "g",
    Ğ: "G",
    ı: "i",
    İ: "I",
    ö: "o",
    Ö: "O",
    ş: "s",
    Ş: "S",
    ü: "u",
    Ü: "U",
  };

  let sanitized = fileName.replace(
    /[çÇğĞıİöÖşŞüÜ]/g,
    (match) => map[match] || match,
  );
  // Replace spaces and special characters with underscores, keeping dots, dashes and underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Replace multiple consecutive underscores with a single one
  sanitized = sanitized.replace(/_+/g, "_");
  return sanitized;
}
