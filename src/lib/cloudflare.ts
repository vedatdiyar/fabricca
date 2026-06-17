import type { Logger } from "./logger";

interface CloudflareEmbeddingItem {
  object: string;
  embedding: number[];
  index: number;
}

interface CloudflareEmbeddingResponse {
  data: CloudflareEmbeddingItem[];
  model: string;
}

/**
 * Generates vector embeddings for a list of texts using the Cloudflare Worker AI REST API.
 * The model '@cf/qwen/qwen3-embedding-0.6b' is used.
 * Results are mapped and validated to be exactly 768 dimensions.
 *
 * @param texts - List of string texts to extract vector representations for.
 * @param logger - Optional Logger instance for tracking requests.
 * @returns Array of embedding vectors, each containing exactly 768 dimensions.
 */
export async function generateEmbeddings(
  texts: string[],
  logger?: Logger,
): Promise<number[][]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare credentials (CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN) are not defined.",
    );
  }

  const startTime = performance.now();
  logger?.info("ai_request_start", {
    service: "cloudflare",
    step: "generate_embeddings_start",
    data: {
      model: "@cf/qwen/qwen3-embedding-0.6b",
      textsCount: texts.length,
    },
  });

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/embeddings`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "@cf/qwen/qwen3-embedding-0.6b",
        input: texts,
        dimensions: 768,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `Cloudflare API error: ${response.status} ${response.statusText} - ${errorText}`;
      if (logger) {
        const durationMs = performance.now() - startTime;
        logger.error("ai_request_failed", {
          service: "cloudflare",
          filePath: "src/lib/cloudflare.ts",
          step: "generate_embeddings_api_error",
          durationMs,
          error: new Error(errorMsg),
        });
      }
      throw new Error(errorMsg);
    }

    const result = (await response.json()) as CloudflareEmbeddingResponse;
    if (!result || !Array.isArray(result.data)) {
      throw new Error(
        `Cloudflare response format is invalid: ${JSON.stringify(result)}`,
      );
    }

    const embeddings = result.data.map((item: CloudflareEmbeddingItem) => {
      const vector = item.embedding;
      if (!Array.isArray(vector)) {
        throw new Error("Invalid embedding array received from Cloudflare");
      }
      if (vector.length < 768) {
        throw new Error(
          "Cloudflare did not return a 768-dimensional embedding",
        );
      }
      return vector.slice(0, 768);
    });

    const durationMs = performance.now() - startTime;
    logger?.info("ai_request_success", {
      service: "cloudflare",
      step: "generate_embeddings_success",
      durationMs,
      data: {
        model: "@cf/qwen/qwen3-embedding-0.6b",
        count: embeddings.length,
      },
    });

    return embeddings;
  } catch (error) {
    const durationMs = performance.now() - startTime;
    logger?.error("ai_request_failed", {
      service: "cloudflare",
      filePath: "src/lib/cloudflare.ts",
      step: "generate_embeddings_failed",
      durationMs,
      error,
    });
    throw error;
  }
}
