export const CONTACT_EMAIL =
  process.env.CROSSREF_CONTACT_EMAIL || "iletisim@fabricca.com";

export const OPENALEX_USER_AGENT = "FabriccaAcademicAssistant/1.0";

export const CROSSREF_USER_AGENT = `FabriccaAcademicAssistant/1.0 (mailto:${CONTACT_EMAIL})`;

export {
  DEFAULT_MAX_DELAY,
  HttpError,
  fullJitterDelay,
  withRetry,
  type RetryOptions,
} from "@/services/ai/llm-retry";
