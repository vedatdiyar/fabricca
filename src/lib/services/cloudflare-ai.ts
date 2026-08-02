import { Logger } from "../logger";

const BGE_M3_MODEL = "@cf/baai/bge-m3";

/**
 * Generates 1024-d embeddings via Cloudflare Workers AI (`@cf/baai/bge-m3`), batching with concurrency 5.
 *
 * @param texts - The texts to embed.
 * @param logger - Optional logger for embedding events.
 * @returns A 1024-dimensional embedding vector per input text.
 */
export async function generateCloudflareEmbeddings(
  texts: string[],
  logger?: Logger,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    logger?.info("cloudflare_embed_key_missing", {
      service: "cloudflare",
      data: {
        message: "CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN missing.",
      },
    });
    return texts.map(() => new Array(1024).fill(0));
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${BGE_M3_MODEL}`;
  const batchSize = 50;
  const batches: string[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }

  const batchResults: number[][][] = [];
  const maxConcurrency = 5;

  for (let i = 0; i < batches.length; i += maxConcurrency) {
    const chunk = batches.slice(i, i + maxConcurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (batchTexts, batchOffset) => {
        const batchIndex = i + batchOffset;
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: batchTexts,
            }),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error(
              `Cloudflare AI API returned ${response.status}: ${errText}`,
            );
          }

          const data = (await response.json()) as {
            result?: { data?: number[][] };
            success?: boolean;
          };

          if (!data.success || !data.result?.data) {
            throw new Error(
              `Cloudflare AI response invalid: ${JSON.stringify(data)}`,
            );
          }

          return data.result.data;
        } catch (error) {
          logger?.error("cloudflare_embed_batch_failed", {
            service: "cloudflare",
            error,
            data: { batchIndex, textCount: batchTexts.length },
          });
          return batchTexts.map(() => new Array(1024).fill(0));
        }
      }),
    );
    batchResults.push(...chunkResults);
  }

  return batchResults.flat();
}

/**
 * Single-source 1024-d embedding engine backed by Cloudflare Workers AI.
 *
 * @param texts - The texts to embed.
 * @param logger - Optional logger for embedding events.
 * @returns A 1024-dimensional embedding vector per input text.
 */
export async function generateVectorEmbeddings(
  texts: string[],
  logger?: Logger,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  return generateCloudflareEmbeddings(texts, logger);
}
