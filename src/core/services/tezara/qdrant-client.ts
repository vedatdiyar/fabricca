import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL ?? "";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY ?? "";

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

  if (!QDRANT_URL) {
    throw new Error("QDRANT_URL environment variable is not defined.");
  }

  qdrantClient = new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY || undefined,
  });

  return qdrantClient;
}
