import { withRetry, HttpError, DEFAULT_MAX_DELAY } from "@/lib/api-utils";
import type { Logger } from "@/lib/logger";

const UNSTRUCTURED_POLL_INTERVAL_MS = 10 * 1000;
const UNSTRUCTURED_JOB_MAX_WAIT_MS = 5 * 60 * 1000;

const UNSTRUCTURED_MAX_RETRIES = 3;
const UNSTRUCTURED_RETRY_BASE_DELAY_MS = 500;

/** Raw Unstructured element returned by the Transform partitioner. */
export interface UnstructuredElement {
  type?: string;
  element_id?: string;
  text?: string;
  metadata?: {
    page_number?: number;
    text_as_html?: string;
    filename?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Shape of the GET /jobs/{id} response fields used for polling. */
interface JobStatusResponse {
  id?: string;
  status?: string;
  output_node_files?: Array<{
    node_id?: string;
    file_id?: string;
    node_type?: string;
    node_subtype?: string;
  }>;
}

/**
 * Returns the Unstructured API key from the environment, throwing when missing.
 *
 * @returns The UNSTRUCTURED_API_KEY value.
 */
function getUnstructuredApiKey(): string {
  const apiKey = process.env.UNSTRUCTURED_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Unstructured API anahtarı bulunamadı. Lütfen .env.local dosyasında UNSTRUCTURED_API_KEY tanımlayın.",
    );
  }
  return apiKey;
}

/**
 * Returns the Unstructured Transform API base URL, throwing when missing.
 *
 * @returns The UNSTRUCTURED_API_URL value without a trailing slash.
 */
function getUnstructuredApiUrl(): string {
  const apiUrl = process.env.UNSTRUCTURED_API_URL;
  if (!apiUrl) {
    throw new Error(
      "Unstructured API adresi bulunamadı. Lütfen .env.local dosyasında UNSTRUCTURED_API_URL tanımlayın.",
    );
  }
  return apiUrl.replace(/\/+$/, "");
}

/**
 * Parses the `Retry-After` header into milliseconds.
 *
 * @param response - The HTTP response.
 * @returns Delay in milliseconds, or null if missing.
 */
function parseRetryAfterHeader(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
  return null;
}

/**
 * Performs a Unstructured HTTP request with exponential backoff retry.
 *
 * @param url - Endpoint URL.
 * @param init - Fetch request options.
 * @param log - Logger instance.
 * @param logPrefix - Log event prefix.
 * @returns Fetch Response.
 */
function unstructuredFetchWithRetry(
  url: string,
  init: RequestInit,
  log: Logger | undefined,
  logPrefix: string,
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, init);
      if (!response.ok) {
        const errorBody = (await response.text()).slice(0, 300);
        throw new HttpError(
          response.status,
          errorBody,
          parseRetryAfterHeader(response),
        );
      }
      return response;
    },
    {
      maxRetries: UNSTRUCTURED_MAX_RETRIES,
      baseDelay: UNSTRUCTURED_RETRY_BASE_DELAY_MS,
      maxDelay: DEFAULT_MAX_DELAY,
      isRetryable: (error) => {
        if (error instanceof HttpError) {
          return error.status === 429 || error.status >= 500;
        }
        return true;
      },
      getRetryAfter: (error) =>
        error instanceof HttpError ? error.retryAfter : null,
      onRetry: (attempt, delayMs, error) => {
        const httpStatus =
          error instanceof HttpError ? error.status : undefined;
        const retryAfter =
          error instanceof HttpError ? error.retryAfter : undefined;
        log?.info(`${logPrefix}_retry`, {
          service: "library",
          data: {
            attempt,
            maxRetries: UNSTRUCTURED_MAX_RETRIES,
            delayMs: Math.round(delayMs),
            httpStatus,
            retryAfter,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        });
      },
    },
  );
}

/**
 * Creates a local-file processing job on the Unstructured Transform API.
 *
 * @param buffer - The PDF file content as a byte buffer.
 * @param fileName - The original PDF file name.
 * @param requestData - JSON string of the job's request_data (job_nodes).
 * @param log - Logger instance.
 * @returns The created job ID.
 */
export async function createUnstructuredJob(
  buffer: Buffer,
  fileName: string,
  requestData: string,
  log: Logger | undefined,
): Promise<string> {
  const apiKey = getUnstructuredApiKey();
  const apiUrl = getUnstructuredApiUrl();

  const formData = new FormData();
  formData.append(
    "input_files",
    new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
    fileName,
  );
  formData.append("request_data", requestData);

  const response = await unstructuredFetchWithRetry(
    `${apiUrl}/jobs/`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "unstructured-api-key": apiKey,
      },
      body: formData,
    },
    log,
    "unstructured_create_job",
  );

  const json = (await response.json()) as { id?: string };
  if (!json.id) {
    throw new Error("Unstructured yanıtında job ID bulunamadı.");
  }
  return json.id;
}

/**
 * Polls a Unstructured job until it completes or fails.
 *
 * @param jobId - Job ID to poll.
 * @param log - Logger instance.
 * @returns The completed job status response.
 */
export async function pollUnstructuredJob(
  jobId: string,
  log: Logger | undefined,
): Promise<JobStatusResponse> {
  const apiKey = getUnstructuredApiKey();
  const apiUrl = getUnstructuredApiUrl();
  const startTime = performance.now();

  while (true) {
    const response = await unstructuredFetchWithRetry(
      `${apiUrl}/jobs/${jobId}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "unstructured-api-key": apiKey,
        },
      },
      log,
      "unstructured_poll_job",
    );

    const json = (await response.json()) as JobStatusResponse;
    const status = json.status;

    if (status === "COMPLETED") return json;

    if (status === "FAILED" || status === "STOPPED") {
      throw new Error(
        `Unstructured işlemi başarısız oldu (durum: ${status}). JobId: ${jobId}`,
      );
    }

    if (performance.now() - startTime > UNSTRUCTURED_JOB_MAX_WAIT_MS) {
      throw new Error(`Unstructured işlemi zaman aşımına uğradı (${jobId}).`);
    }

    await new Promise((resolve) =>
      setTimeout(resolve, UNSTRUCTURED_POLL_INTERVAL_MS),
    );
  }
}

/**
 * Downloads a single output file of a completed Unstructured job.
 *
 * @param jobId - Completed job ID.
 * @param fileId - Output file ID from the job's output_node_files.
 * @returns The parsed output JSON (array of elements, or arbitrary JSON).
 */
export async function downloadUnstructuredJobOutput(
  jobId: string,
  fileId: string,
): Promise<unknown> {
  const apiKey = getUnstructuredApiKey();
  const apiUrl = getUnstructuredApiUrl();

  const response = await unstructuredFetchWithRetry(
    `${apiUrl}/jobs/${jobId}/download?file_id=${encodeURIComponent(fileId)}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        "unstructured-api-key": apiKey,
      },
    },
    undefined,
    "unstructured_download_output",
  );

  return (await response.json()) as unknown;
}

/**
 * Cancels a running Unstructured job.
 *
 * @param jobId - Job ID to cancel.
 */
export async function cancelUnstructuredJob(jobId: string): Promise<void> {
  const apiKey = getUnstructuredApiKey();
  const apiUrl = getUnstructuredApiUrl();

  try {
    await unstructuredFetchWithRetry(
      `${apiUrl}/jobs/${jobId}/cancel`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "unstructured-api-key": apiKey,
        },
      },
      undefined,
      "unstructured_cancel_job",
    );
  } catch {
    // Cancellation is best-effort cleanup; failures are intentionally swallowed.
  }
}
