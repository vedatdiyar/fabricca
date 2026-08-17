import type { TezaraThesisDetails } from "@/lib/types";

/**
 * Extracts the most reliable abstract text from a raw thesis payload.
 *
 * @param payload - Raw thesis payload dictionary.
 * @returns Abstract string, preferring original over translated text.
 */
export function extractAbstract(payload: Record<string, unknown>): string {
  let abstract = String(
    payload.abstract_original ?? payload.abstract ?? "",
  ).trim();
  if (!abstract || abstract.length < 10 || /^özet yok\.?$/i.test(abstract)) {
    abstract = String(payload.abstract_translated ?? "").trim();
  }
  return abstract;
}

/**
 * Maps a Qdrant point payload to TezaraThesisDetails.
 *
 * @param id - Point ID.
 * @param payload - Raw payload from Qdrant.
 * @returns Standardized thesis details object.
 */
export function mapPayloadToDetails(
  id: number,
  payload: Record<string, unknown>,
): TezaraThesisDetails {
  const titleOriginal = String(
    payload.title_original ?? payload.title ?? "",
  ).trim();
  const titleTranslated = String(payload.title_translated ?? "").trim();
  const title =
    titleTranslated && titleTranslated !== titleOriginal
      ? `${titleOriginal} / ${titleTranslated}`
      : titleOriginal;

  return {
    id,
    title,
    author: String(payload.author ?? "N/A"),
    university: String(payload.university ?? "N/A"),
    year: parseInt(String(payload.year ?? "0"), 10) || 0,
    thesisType: String(payload.thesis_type ?? payload.thesisType ?? "N/A"),
    department: String(payload.department ?? "N/A"),
    language: payload.language ? String(payload.language) : undefined,
    abstract: extractAbstract(payload),
    yokPdfUrl: payload.pdf_url ? String(payload.pdf_url) : undefined,
  };
}
