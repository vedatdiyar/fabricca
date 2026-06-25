import { CROSSREF_USER_AGENT } from "../_shared";
import { formatAcademicTitle } from "@/lib/utils/academic-formatter";
import type { ValidatedPaper } from "../literature-review-papers";
import type { Logger } from "@/lib/logger";

export async function validateWithCrossRef(
  paper: ValidatedPaper,
  logger?: Logger,
): Promise<ValidatedPaper> {
  if (
    !paper.doi ||
    paper.doi.toLowerCase().trim() === "not_provided" ||
    !/^10\.\d{4,}/.test(paper.doi.trim())
  )
    return paper;

  const contactEmail = process.env.CROSSREF_CONTACT_EMAIL;
  const endpoint = `https://api.crossref.org/works/${encodeURIComponent(paper.doi)}${contactEmail ? `?mailto=${encodeURIComponent(contactEmail)}` : ""}`;

  const CROSSREF_MAX_RETRIES = 3;
  const CROSSREF_BASE_DELAY_MS = 1000;
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      const response = await fetch(endpoint, {
        headers: { "User-Agent": CROSSREF_USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const body = (await response.json()) as
          | { message?: Record<string, unknown> }
          | undefined;
        const message = body?.message;
        if (!message) return paper;

        const authorList = message.author as
          | { given?: string; family?: string }[]
          | undefined;
        if (authorList && authorList.length > 0) {
          const resolvedAuthors: string[] = [];
          for (const a of authorList) {
            const given = (a.given ?? "").trim();
            const family = (a.family ?? "").trim();
            const full = `${given} ${family}`.trim();
            if (full) resolvedAuthors.push(full);
          }
          if (resolvedAuthors.length > 0) {
            paper.authors = resolvedAuthors;
          }
        }

        const crossrefUrl = message.URL as string | undefined;
        if (crossrefUrl) paper.url = crossrefUrl;

        const publisher = message.publisher as string | undefined;
        const containerTitle = message["container-title"] as
          | string[]
          | undefined;
        if (publisher) paper.publisher = publisher;
        else if (containerTitle && containerTitle.length > 0) {
          paper.publisher = containerTitle[0];
        }

        const title = message.title as string[] | undefined;
        if (title && title.length > 0) {
          paper.title = formatAcademicTitle(title[0]);
        }

        const published = message.published as
          | { "date-parts"?: number[][] }
          | undefined;
        const dateParts = published?.["date-parts"];
        if (dateParts && dateParts.length > 0 && dateParts[0].length > 0) {
          paper.year = dateParts[0][0];
        }

        return paper;
      }

      const isRetryable =
        response.status === 429 ||
        response.status === 503 ||
        response.status >= 500;

      if (isRetryable && attempt <= CROSSREF_MAX_RETRIES) {
        const backoff = CROSSREF_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = backoff * 0.3 * Math.random();
        const delayMs = backoff + jitter;

        logger?.warn("crossref_retry", {
          service: "crossref",
          filePath:
            "onboarding/literature-review/_services/crossref/validator.ts",
          step: `retry_attempt_${attempt}`,
          durationMs: delayMs,
          data: {
            attempt,
            maxRetries: CROSSREF_MAX_RETRIES,
            doi: paper.doi,
            status: response.status,
            delayMs: Math.round(delayMs),
          },
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      logger?.warn("crossref_non_ok", {
        service: "crossref",
        filePath:
          "onboarding/literature-review/_services/crossref/validator.ts",
        data: {
          doi: paper.doi,
          status: response.status,
          attempt,
        },
      });

      return paper;
    } catch (error) {
      if (attempt <= CROSSREF_MAX_RETRIES) {
        const backoff = CROSSREF_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = backoff * 0.3 * Math.random();
        const delayMs = backoff + jitter;

        logger?.warn("crossref_network_retry", {
          service: "crossref",
          filePath:
            "onboarding/literature-review/_services/crossref/validator.ts",
          step: `retry_attempt_${attempt}`,
          durationMs: delayMs,
          data: {
            attempt,
            maxRetries: CROSSREF_MAX_RETRIES,
            doi: paper.doi,
            delayMs: Math.round(delayMs),
            error: error instanceof Error ? error.message : String(error),
          },
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      logger?.warn("crossref_failed", {
        service: "crossref",
        filePath:
          "onboarding/literature-review/_services/crossref/validator.ts",
        data: {
          doi: paper.doi,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return paper;
    }
  }
}
