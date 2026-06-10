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
 * Arama derinliği 'advanced', kaynak başına parça adedi 3, maksimum sonuç sayısı 5
 * ve tam eşleşme (exact_match) aktif olarak yapılandırılmıştır.
 *
 * @param query - İnternet üzerinde aranacak ve maddi doğrulanacak sorgu metni.
 * @returns Arama sonuçlarını içeren TavilySearchResponse nesnesi.
 * @throws Tavily API anahtarı tanımlanmadığında veya istek başarısız olduğunda hata fırlatır.
 */
export async function tavilySearch(
  query: string,
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
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
      max_results: 5,
      exact_match: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
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

  return {
    query: String(rawData.query || query),
    responseTime: Number(rawData.response_time || 0),
    results,
  };
}
