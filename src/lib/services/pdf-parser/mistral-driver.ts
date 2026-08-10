import type { Logger } from "@/lib/logger";
import { generatePresignedReadUrl } from "@/lib/services/r2";
import { normalizeAcademicText } from "@/lib/services/pdf/normalizer";

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generates a short-lived R2 presigned URL for the PDF, then submits it to
 * Mistral OCR (`mistral-ocr-latest`). Returns page-level markdown strings in
 * page order (index 0 = page 1).
 *
 * The presigned URL approach avoids any Vercel-side upload; Mistral fetches
 * the PDF directly from R2 (server-to-server), reducing total OCR time from
 * ~12 s (base64 inline) to ~1.7 s for a 50-page, 17 MB document.
 *
 * @param r2Key - R2 object key of the already-uploaded PDF (e.g. "pdfs/Foo_2024.pdf").
 * @param logger - Optional logger instance.
 * @returns Array of normalized markdown strings, one per page, in reading order.
 * @throws When Mistral OCR returns a non-2xx response after all retry attempts.
 */
export async function runMistralOcr(
  r2Key: string,
  logger?: Logger,
): Promise<string[]> {
  const apiKey = process.env.MISTRAL_OCR_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_OCR_API_KEY environment variable is not set.");
  }

  // Generate a presigned read URL (~6ms, local HMAC signing — no network call)
  const documentUrl = await generatePresignedReadUrl(r2Key, 300);

  logger?.info("mistral_ocr_start", {
    service: "pdf-parser",
    data: { r2Key },
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(MISTRAL_OCR_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-ocr-latest",
          document: {
            type: "document_url",
            document_url: documentUrl,
          },
          include_image_base64: false,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "(unreadable)");
        const err = new Error(
          `Mistral OCR HTTP ${response.status}: ${errorBody.slice(0, 300)}`,
        );

        // 429 — rate limited: retry after delay
        if (response.status === 429 && attempt < MAX_ATTEMPTS) {
          logger?.info("mistral_ocr_rate_limited_retry", {
            service: "pdf-parser",
            data: { r2Key, attempt, retryDelayMs: RETRY_DELAY_MS },
          });
          await sleep(RETRY_DELAY_MS);
          lastError = err;
          continue;
        }

        throw err;
      }

      const result = (await response.json()) as {
        pages?: Array<{ index: number; markdown?: string }>;
      };

      const pages = result.pages ?? [];

      if (pages.length === 0) {
        throw new Error(
          `Mistral OCR returned 0 pages for r2Key="${r2Key}". Response may be empty or unsupported format.`,
        );
      }

      // Sort by index (API guarantees order, but defensive)
      pages.sort((a, b) => a.index - b.index);

      const markdowns = pages.map((p) =>
        normalizeAcademicText(p.markdown ?? ""),
      );

      logger?.info("mistral_ocr_success", {
        service: "pdf-parser",
        data: { r2Key, pageCount: markdowns.length, attempt },
      });

      return markdowns;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  logger?.info("mistral_ocr_failed", {
    service: "pdf-parser",
    error: lastError,
  });

  throw lastError;
}
