import {
  ThinkingLevel,
  Type,
} from "@google/genai";
import { getAi, retryOn503 } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type { GeminiThesisBox, FoundationalQuery } from "@/lib/types";
import {
  foundationalOracleResponseSchema,
  buildFoundationalOracleSystemInstruction,
  buildFoundationalOracleUserPrompt,
} from "@/lib/prompts";

interface ExaResult {
  title: string;
  url: string;
  author?: string;
  text?: string;
  publishedDate?: string;
}

interface CrossrefResult {
  doi: string | null;
  publisher: string | null;
  title: string | null;
  author: string | null;
  publicationYear: number | null;
}

const exaSearchTool = {
  functionDeclarations: [
    {
      name: "exa_academic_search",
      description:
        "DergiPark, Google Scholar ve uluslararası akademik indekslerde semantik arama yaparak gerçek makale ve kitapları getirir.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description:
              "Kutunun ruhuna uygun, uydurma olmayan, literatürde kullanılan saf akademik semantik arama sorgusu.",
          },
        },
        required: ["query"],
      },
    },
  ],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function calculateTitleScore(itemTitle: string, queryTitle: string): number {
  const itemTokens = new Set(tokenize(itemTitle));
  const queryTokens = tokenize(queryTitle);
  if (queryTokens.length === 0) return 0;
  const matches = queryTokens.filter((t) => itemTokens.has(t));
  return matches.length / queryTokens.length;
}

function matchAuthor(
  itemAuthorList: { given?: string; family?: string }[] | undefined,
  queryAuthor: string,
): boolean {
  if (!itemAuthorList || !queryAuthor) return false;
  const qaTokens = new Set(tokenize(queryAuthor));
  return itemAuthorList.some((a) => {
    const full = `${a.given ?? ""} ${a.family ?? ""}`;
    const iaTokens = new Set(tokenize(full));
    const overlap = [...qaTokens].filter((t) => iaTokens.has(t)).length;
    return qaTokens.size > 0 && overlap / qaTokens.size >= 0.5;
  });
}

function extractYear(item: Record<string, unknown>): number | null {
  const issued = item.issued as { "date-parts"?: number[][] } | undefined;
  const dateParts = issued?.["date-parts"]?.[0];
  if (dateParts?.[0]) return dateParts[0];
  return null;
}

/**
 * Parses the Retry-After header which can be seconds or an HTTP-date.
 * Returns the delay in milliseconds, or null if invalid or missing.
 *
 * @param header - The raw Retry-After header string.
 * @returns Delay in milliseconds or null.
 */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(header);
  if (!isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : 0;
  }
  return null;
}

/**
 * Exa API semantik arama fonksiyonu.
 * Hata durumunda (özellikle 429 rate limit) Retry-After başlığına riayet ederek
 * üstel geri çekilme (exponential backoff) ve jitter ile yeniden dener.
 *
 * @param query - Semantik arama sorgusu
 * @param log - Loglama için Logger instance'ı
 * @returns Arama sonuçları listesi
 */
async function searchExa(query: string, log?: Logger): Promise<ExaResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey)
    throw new Error("EXA_API_KEY environment variable is not defined");

  const maxRetries = 4;
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          query,
          type: "auto",
          category: "research",
          numResults: 5,
          contents: { text: { maxCharacters: 15000 } },
        }),
      });

      if (response.status === 429) {
        if (attempt > maxRetries) {
          log?.error("exa_rate_limit_exhausted", {
            service: "boxes",
            data: { query, maxRetries },
          });
          return [];
        }

        const retryAfterHeader = response.headers.get("retry-after");
        const parsedDelay = parseRetryAfter(retryAfterHeader);

        const exponent = attempt - 1;
        const backoffDelay = 2000 * Math.pow(2, exponent);
        const jitter = Math.random() * 1000;
        const delay =
          parsedDelay !== null ? parsedDelay : backoffDelay + jitter;

        log?.warn("exa_rate_limited", {
          service: "boxes",
          data: {
            attempt,
            maxRetries,
            delayMs: Math.round(delay),
            retryAfterHeader,
            query,
          },
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        log?.error("exa_non_ok_response", {
          service: "boxes",
          data: { status: response.status, query },
        });
        return [];
      }

      const data = (await response.json()) as {
        results: Array<{
          title: string;
          url: string;
          author?: string;
          text?: string;
          publishedDate?: string;
        }>;
      };

      return data.results || [];
    } catch (error) {
      const is429Retryable =
        error instanceof Error &&
        (error.message.includes("429") || error.message.includes("quota"));

      if (is429Retryable && attempt <= maxRetries) {
        const exponent = attempt - 1;
        const delay = 2000 * Math.pow(2, exponent) + Math.random() * 1000;
        log?.warn("exa_429_retry", {
          service: "boxes",
          data: {
            attempt,
            maxRetries,
            delayMs: Math.round(delay),
            error: error.message,
            query,
          },
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      log?.error("exa_search_failed", {
        service: "boxes",
        data: {
          query,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return [];
    }
  }
}

export async function lookupCrossref(
  title: string,
  author: string,
): Promise<CrossrefResult> {
  const mailto = "iletisim@fabricca.com";
  const SELECT_FIELDS = "DOI,title,author,publisher,container-title,issued";

  async function fetchWorks(
    queryParam: string,
    value: string,
  ): Promise<Record<string, unknown>[]> {
    const url = `https://api.crossref.org/works?${queryParam}=${encodeURIComponent(value)}&rows=5&select=${SELECT_FIELDS}&mailto=${mailto}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FabriccaTest/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      message?: { items?: Record<string, unknown>[] };
    };
    return data?.message?.items ?? [];
  }

  // Phase 1: Precise title search
  let items = await fetchWorks("query.title", title);

  // Phase 2: Fall back to broader bibliographic search
  if (items.length === 0) {
    items = await fetchWorks("query.bibliographic", `${author} ${title}`);
  }

  if (items.length === 0)
    return {
      doi: null,
      publisher: null,
      title: null,
      author: null,
      publicationYear: null,
    };

  // Score each candidate by title overlap + author bonus + year bonus
  const queryTitle = title.toLowerCase().trim();
  const queryAuthor = author.toLowerCase().trim();

  const scored = items
    .map((item) => {
      const itemTitle = ((item.title as string[])?.[0] ?? "")
        .toLowerCase()
        .trim();
      const itemAuthorList = item.author as
        { given?: string; family?: string }[] | undefined;
      const itemYear = extractYear(item);

      const titleScore = calculateTitleScore(itemTitle, queryTitle);
      const authorBonus = matchAuthor(itemAuthorList, queryAuthor) ? 0.3 : 0;
      const yearBonus = itemYear ? 0.1 : 0;
      const totalScore = titleScore + authorBonus + yearBonus;

      return { item, score: totalScore };
    })
    .filter((s) => s.score >= 0.5);

  if (scored.length === 0)
    return {
      doi: null,
      publisher: null,
      title: null,
      author: null,
      publicationYear: null,
    };

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].item;
  const rawDoi = best.DOI as string | null | undefined;
  const doi = rawDoi?.trim() || null;
  const publisher =
    (best.publisher as string) ??
    (best["container-title"] as string[])?.[0] ??
    null;

  const rawTitle = (best.title as string[])?.[0] || null;

  const itemAuthorList = best.author as
    { given?: string; family?: string }[] | undefined;
  let parsedAuthor: string | null = null;
  if (itemAuthorList && itemAuthorList.length > 0) {
    parsedAuthor = itemAuthorList
      .map((a) => `${a.given ?? ""} ${a.family ?? ""}`.trim())
      .filter((name) => name.length > 0)
      .join(", ");
  }

  const publicationYear = extractYear(best);

  return {
    doi,
    publisher,
    title: rawTitle,
    author: parsedAuthor,
    publicationYear,
  };
}

interface MinedBoxResult {
  flatIndex: number;
  foundationalQuery: FoundationalQuery;
}

export async function processSingleBox(
  box: GeminiThesisBox,
  flatIndex: number,
  thesisMatrix: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    methodology: string;
    researchScope: string;
    mainClaim: string;
  },
  log: Logger,
): Promise<MinedBoxResult | null> {
  const ai = getAi();

  const USER_PROMPT = buildFoundationalOracleUserPrompt({
    studyTitle: thesisMatrix.studyTitle,
    researchQuestion: thesisMatrix.researchQuestion,
    theoreticalFramework: thesisMatrix.theoreticalFramework,
    methodology: thesisMatrix.methodology,
    researchScope: thesisMatrix.researchScope,
    mainClaim: thesisMatrix.mainClaim,
    box: {
      title: box.title,
      boxType: box.boxType,
      description: box.description,
      concepts: box.concepts,
      semanticQuery: box.semanticQuery,
    },
  });

  const commonConfig = {
    systemInstruction: buildFoundationalOracleSystemInstruction(),
    temperature: 1.0,
    seed: 42,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  };

  const contents: Array<{
    role: string;
    parts: import("@google/genai").Part[];
  }> = [{ role: "user", parts: [{ text: USER_PROMPT }] }];

  // -------------------------------------------------------------------
  // Phase 1: Collect search queries from Gemini (agentic loop, no Exa)
  // -------------------------------------------------------------------
  let iteration = 0;
  const MAX_ITERATIONS = 3;
  const collectedQueries: string[] = [];

  while (iteration < MAX_ITERATIONS) {
    const config: Record<string, unknown> = {
      ...commonConfig,
      tools: [exaSearchTool],
    };

    const { result: response } = await retryOn503(
      () =>
        ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: contents as Parameters<
            typeof ai.models.generateContent
          >[0]["contents"],
          config: config as Parameters<
            typeof ai.models.generateContent
          >[0]["config"],
        }),
      3,
      1000,
      log,
    );

    const modelParts = response.candidates?.[0]?.content?.parts;
    if (!modelParts || modelParts.length === 0) {
      throw new Error(`Boş yanıt: ${box.title}`);
    }

    const functionCallPart = modelParts.find(
      (p: import("@google/genai").Part) => p.functionCall,
    );

    if (functionCallPart?.functionCall?.args?.query) {
      const query = String(functionCallPart.functionCall.args.query);
      collectedQueries.push(query);
      iteration++;

      log.info("exa_search_query_collected", {
        service: "boxes",
        data: {
          boxTitle: box.title,
          iteration,
          queryCount: collectedQueries.length,
          query,
        },
      });

      contents.push({ role: "model", parts: modelParts });
      contents.push({
        role: "user",
        parts: [
          {
            text: `"${query}" sorgusu için arama başlatıldı. Lütfen bir sonraki sorguyu üret.`,
          },
        ],
      });
    } else {
      break;
    }
  }

  if (collectedQueries.length === 0) {
    log.warn("no_queries_collected", {
      service: "boxes",
      data: { boxTitle: box.title },
    });
    return null;
  }

  // -------------------------------------------------------------------
  // Phase 2: Execute all collected queries in parallel via Promise.all
  // -------------------------------------------------------------------
  log.info("exa_parallel_search_start", {
    service: "boxes",
    data: { boxTitle: box.title, queryCount: collectedQueries.length },
  });

  const parallelSearchStart = performance.now();

  const allResultsArrays = await Promise.all(
    collectedQueries.map((q) =>
      searchExa(q, log).catch(() => [] as ExaResult[]),
    ),
  );

  log.info("exa_parallel_search_done", {
    service: "boxes",
    durationMs: performance.now() - parallelSearchStart,
    data: {
      boxTitle: box.title,
      queryCount: collectedQueries.length,
      totalResults: allResultsArrays.reduce((s, a) => s + a.length, 0),
    },
  });

  // Use the last non-empty result set for backward compatibility
  let exaRawResults: ExaResult[] = [];
  for (const arr of allResultsArrays) {
    if (arr.length > 0) {
      exaRawResults = arr;
    }
  }

  if (exaRawResults.length === 0) {
    log.warn("no_exa_results", {
      service: "boxes",
      data: { boxTitle: box.title },
    });
    return null;
  }

  // -------------------------------------------------------------------
  // Phase 3: Present all parallel results to Gemini for final selection
  // -------------------------------------------------------------------
  const allSanitized = allResultsArrays.map((group) =>
    group.map((r) => ({
      title: r.title,
      author: r.author ?? null,
      publicationYear: r.publishedDate
        ? new Date(r.publishedDate).getFullYear()
        : null,
    })),
  );

  const summaryLines: string[] = [];
  for (let i = 0; i < allSanitized.length; i++) {
    const group = allSanitized[i];
    summaryLines.push(`Sorgu ${i + 1} sonuçları:`);
    for (const r of group) {
      summaryLines.push(
        `- ${r.title} (${r.author}, ${r.publicationYear ?? "Tarih yok"})`,
      );
    }
  }

  contents.push({
    role: "user",
    parts: [
      {
        text: `Tüm arama sonuçları:\n${summaryLines.join("\n")}\n\nŞimdi en uygun kurucu eseri seç.`,
      },
    ],
  });

  const finalConfig: Record<string, unknown> = {
    ...commonConfig,
    toolConfig: { functionCallingConfig: { mode: "NONE" } },
    responseMimeType: "application/json",
    responseJsonSchema: foundationalOracleResponseSchema,
  };

  const { result: finalResponse } = await retryOn503(
    () =>
      ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: contents as Parameters<
          typeof ai.models.generateContent
        >[0]["contents"],
        config: finalConfig as Parameters<
          typeof ai.models.generateContent
        >[0]["config"],
      }),
    3,
    1000,
    log,
  );

  const finalText = finalResponse.text;
  if (!finalText) {
    throw new Error(`Model NONE modunda metin döndürmedi: ${box.title}`);
  }

  // -------------------------------------------------------------------
  // Phase 4: Parse selection, Crossref lookup, return result
  // -------------------------------------------------------------------
  let cleaned = finalText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();
  }

  const outputObj = JSON.parse(cleaned) as { selectedIndex: number };
  const sIdx = outputObj.selectedIndex;
  const finalIdx = Math.max(0, Math.min(sIdx, exaRawResults.length - 1));
  const selectedResult = exaRawResults[finalIdx];

  const authorName = selectedResult.author || "Unknown Author";
  const pubYear = selectedResult.publishedDate
    ? new Date(selectedResult.publishedDate).getFullYear()
    : 0;

  // Crossref lookup
  const crossref = await lookupCrossref(selectedResult.title, authorName);

  const finalTitle = crossref.title?.trim() || selectedResult.title;
  let finalAuthor = crossref.author?.trim() || authorName;
  if (
    (!finalAuthor || finalAuthor.toLowerCase() === "unknown author") &&
    authorName &&
    authorName.toLowerCase() !== "unknown author"
  ) {
    finalAuthor = authorName;
  }
  const finalYear = crossref.publicationYear || pubYear;

  return {
    flatIndex,
    foundationalQuery: {
      title: finalTitle,
      author: finalAuthor,
      publicationYear: finalYear,
      doi: crossref.doi,
      publisher: crossref.publisher,
    },
  };
}
