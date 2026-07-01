import type { Logger } from "./logger";

/**
 * Tavily Arama Sonucu Öğe Arayüzü.
 */
export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  rawContent?: string;
}

/**
 * Tavily Arama Yanıt Arayüzü.
 */
export interface TavilySearchResponse {
  query: string;
  responseTime: number;
  results: TavilySearchResult[];
}

/**
 * Tavily Search API'sini kullanarak arama yapan jenerik fonksiyon.
 * Arama derinliği 'advanced', kaynak başına parça adedi 3, maksimum sonuç sayısı 3
 * ve tam eşleşme (exact_match) aktif olarak yapılandırılmıştır.
 *
 * @param query - İnternet üzerinde aranacak ve maddi doğrulanacak sorgu metni.
 * @param logger - Opsiyonel Logger instance'ı (search event logları için)
 * @returns Arama sonuçlarını içeren TavilySearchResponse nesnesi.
 * @throws Tavily API anahtarı tanımlanmadığında veya istek başarısız olduğunda hata fırlatır.
 */
export async function tavilySearch(
  query: string,
  logger?: Logger,
): Promise<TavilySearchResponse> {
  const startTime = performance.now();
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    const durationMs = performance.now() - startTime;
    logger?.error("search_filtered", {
      service: "tavily",
      filePath: "src/lib/tavily.ts",
      durationMs,
      data: { query, reason: "TAVILY_API_KEY eksik" },
      error: new Error("TAVILY_API_KEY ortam değişkeni tanımlı değil."),
    });
    throw new Error("TAVILY_API_KEY ortam değişkeni tanımlı değil.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      chunks_per_source: 3,
      max_results: 3,
    }),
  });

  if (!response.ok) {
    const durationMs = performance.now() - startTime;
    const errorText = await response.text();
    logger?.error("search_filtered", {
      service: "tavily",
      filePath: "src/lib/tavily.ts",
      durationMs,
      data: { query, status: response.status },
      error: new Error(`Tavily API hatası (${response.status}): ${errorText}`),
    });
    throw new Error(`Tavily API hatası (${response.status}): ${errorText}`);
  }

  const rawData = (await response.json()) as Record<string, unknown>;
  const rawResults = (rawData.results || []) as Record<string, unknown>[];

  const results: TavilySearchResult[] = rawResults.map((item) => ({
    title: String(item.title || ""),
    url: String(item.url || ""),
    content: String(item.content || ""),
    score: Number(item.score || 0),
    rawContent: item.raw_content ? String(item.raw_content) : undefined,
  }));

  const durationMs = performance.now() - startTime;

  if (results.length === 0) {
    logger?.warn("search_empty", {
      service: "tavily",
      filePath: "src/lib/tavily.ts",
      durationMs,
      data: { query },
    });
  }

  return {
    query: String(rawData.query || query),
    responseTime: Number(rawData.response_time || 0),
    results,
  };
}
