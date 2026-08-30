/**
 * Centralized external service endpoints.
 * All hardcoded base URLs MUST be imported from here — no string literals in service files.
 */

export const OPENALEX_BASE_URL = "https://api.openalex.org" as const;
export const CROSSREF_BASE_URL = "https://api.crossref.org" as const;
export const COHERE_RERANK_URL = "https://api.cohere.com/v2/rerank" as const;
export const HF_EMBEDDING_BASE_URL = "https://router.huggingface.co" as const;
export const HF_E5_ENDPOINT = `${HF_EMBEDDING_BASE_URL}/hf-inference/models/intfloat/multilingual-e5-base/pipeline/feature-extraction` as const;
export const YOK_THESIS_BASE_URL = "https://tez.yok.gov.tr/UlusalTezMerkezi" as const;
export const R2_ENDPOINT_TEMPLATE = "https://{accountId}.r2.cloudflarestorage.com" as const;

export function buildR2Endpoint(accountId: string): string {
  return R2_ENDPOINT_TEMPLATE.replace("{accountId}", accountId);
}

export function buildOpenAlexUrl(path: string, params?: URLSearchParams): string {
  const base = `${OPENALEX_BASE_URL}${path}`;
  if (!params || params.toString() === "") return base;
  return `${base}?${params.toString().replace(/\+/g, "%20")}`;
}

export function buildCrossrefUrl(path: string): string {
  return `${CROSSREF_BASE_URL}${path}`;
}

export function buildYokThesisUrl(id: number | string): string {
  return `${YOK_THESIS_BASE_URL}/tezDetay.jsp?id=${id}`;
}
