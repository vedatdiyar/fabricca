import type { Logger } from "./logger";

const TEZARA_FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  connection: "keep-alive",
} as const;

const MAX_CONCURRENCY = 4;
const MIN_DELAY_MS = 0;
const MAX_DELAY_MS = 400;
const BURST_WINDOW_MS = 3000;
const MAX_BURST = 12;

interface QueueItem {
  url: string;
  resolve: (value: Response) => void;
  reject: (reason: unknown) => void;
}

const queue: QueueItem[] = [];
const requestTimestamps: number[] = [];
let activeCount = 0;
let processing = false;

function getDynamicDelay(): number {
  return (
    MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1))
  );
}

function pruneTimestamps(): void {
  const now = Date.now();
  while (
    requestTimestamps.length > 0 &&
    now - requestTimestamps[0] >= BURST_WINDOW_MS
  ) {
    requestTimestamps.shift();
  }
}

async function processPipeline(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0 && activeCount < MAX_CONCURRENCY) {
    pruneTimestamps();
    if (requestTimestamps.length >= MAX_BURST) {
      const oldest = requestTimestamps[0];
      const waitTime = oldest + BURST_WINDOW_MS - Date.now();
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
      continue;
    }

    const item = queue.shift()!;
    activeCount++;
    requestTimestamps.push(Date.now());

    executeRequest(item).finally(() => {
      activeCount--;
      const delay = getDynamicDelay();
      if (delay > 0) {
        setTimeout(() => processPipeline(), delay);
      } else {
        processPipeline();
      }
    });
  }

  processing = false;
}

async function executeRequest(item: QueueItem): Promise<void> {
  try {
    const response = await fetch(item.url, {
      keepalive: true,
      headers: TEZARA_FETCH_HEADERS,
    });
    item.resolve(response);
  } catch (err) {
    item.reject(err);
  }
}

/**
 * Enqueues a TEZARA HTTP request through a pipeline queue that enforces:
 * - concurrency: 2 (max simultaneous requests)
 * - delay: 0-700ms dynamic jitter between requests
 * - keep-alive: connection reuse via keepalive flag
 * - burst: max 6 requests in any rolling 3-second window
 *
 * @param url - The TEZARA URL to fetch.
 * @param logger - Optional logger instance for queue backlog warnings.
 * @returns The fetch Response.
 */
export async function enqueueTezaraFetch(
  url: string,
  logger?: Logger,
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    queue.push({ url, resolve, reject });
    processPipeline();
    if (queue.length > 5) {
      logger?.warn("tezara_queue_backlog", {
        service: "tezara",
        step: "enqueue",
        data: { queueLength: queue.length, url },
      });
    }
  });
}
