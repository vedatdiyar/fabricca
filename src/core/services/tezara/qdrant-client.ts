import { QdrantClient } from "@qdrant/js-client-rest";

/** Global singleton Qdrant client instance. */
let qdrantClient: QdrantClient | null = null;

/**
 * Returns the singleton Qdrant client connected to the Qdrant Cloud cluster.
 *
 * @throws Error when QDRANT_URL is missing.
 * @returns Qdrant client instance.
 */
export function getQdrantClient(): QdrantClient {
  if (qdrantClient) {
    return qdrantClient;
  }

  const qdrantUrl = process.env.QDRANT_URL ?? "";
  const qdrantApiKey = process.env.QDRANT_API_KEY ?? "";

  if (!qdrantUrl) {
    throw new Error("QDRANT_URL environment variable is not defined.");
  }

  qdrantClient = new QdrantClient({
    url: qdrantUrl,
    apiKey: qdrantApiKey || undefined,
  });

  return qdrantClient;
}
