import type { Logger } from "@/lib/logger";
import { generatePresignedReadUrl } from "@/lib/services/r2";
import { normalizeAcademicText } from "@/lib/services/pdf/normalizer";
import {
  resolveMistralPrintedPages,
  type MistralOcrPage,
} from "./printed-page-number";

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Minimal structural block shape returned by Mistral OCR `include_blocks`. */
interface MistralBlock {
  type?: string;
  content?: string | null;
  top_left_x?: number | null;
  top_left_y?: number | null;
  bottom_right_x?: number | null;
  bottom_right_y?: number | null;
}

/** Minimal OCR page response shape (superset of what we consume). */
interface MistralOcrResponsePage {
  index: number;
  markdown?: string;
  header?: string | null;
  footer?: string | null;
  blocks?: MistralBlock[] | null;
}

/**
 * Generates a short-lived R2 presigned URL for the PDF, then submits it to
 * Mistral OCR 4 (`mistral-ocr-latest`) with header/footer block extraction
 * enabled.
 *
 * The presigned URL approach avoids any Vercel-side upload; Mistral fetches
 * the PDF directly from R2 (server-to-server), reducing total OCR time from
 * ~12 s (base64 inline) to ~1.7 s for a 50-page, 17 MB document.
 *
 * `include_blocks: true` + `extract_header/footer: true` isolate the running
 * head so the printed page number can be parsed from it; the same anchor
 * (+1 consecutive run) logic as the born-digital path rejects years and
 * decorative digits. Headers/footers are removed from the emitted markdown.
 *
 * @param r2Key - R2 object key of the already-uploaded PDF (e.g. "pdfs/Foo_2024.pdf").
 * @param logger - Optional logger instance.
 * @returns Per-page markdown plus a detected printed page number, in page order.
 * @throws When Mistral OCR returns a non-2xx response after all retry attempts.
 */
export async function runMistralOcr(
  r2Key: string,
  logger?: Logger,
): Promise<MistralOcrPage[]> {
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
          include_blocks: true,
          extract_header: true,
          extract_footer: true,
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
        pages?: MistralOcrResponsePage[];
      };

      const rawPages = result.pages ?? [];

      if (rawPages.length === 0) {
        throw new Error(
          `Mistral OCR returned 0 pages for r2Key="${r2Key}". Response may be empty or unsupported format.`,
        );
      }

      // Sort by index (API guarantees order, but defensive)
      rawPages.sort((a, b) => a.index - b.index);

      // Resolve printed numbers from the isolated header/footer strings using
      // the same +1 anchor chain as the born-digital path.
      const printedByPage = resolveMistralPrintedPages(
        rawPages.map((p) => ({ index: p.index, header: p.header, footer: p.footer })),
      );

      const pages: MistralOcrPage[] = rawPages.map((p) => {
        const printed = printedByPage.get(p.index);
        const markdown = normalizeAcademicText(p.markdown ?? "");
        // Fallback: if the model embedded a trailing page number in the markdown
        // running head, still prefer the anchor-resolved value when present.
        return {
          index: p.index,
          markdown,
          ...(printed !== undefined ? { printedPageNumber: String(printed) } : {}),
        };
      });

      logger?.info("mistral_ocr_success", {
        service: "pdf-parser",
        data: {
          r2Key,
          pageCount: pages.length,
          printedPagesDetected: printedByPage.size,
          attempt,
        },
      });

      return pages;
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
