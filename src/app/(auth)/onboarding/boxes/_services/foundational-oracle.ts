import {
  ThinkingLevel,
  Type,
  createPartFromFunctionResponse,
} from "@google/genai";
import { getAi } from "@/lib/gemini";
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

async function searchExa(query: string): Promise<ExaResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey)
    throw new Error("EXA_API_KEY environment variable is not defined");

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      query,
      mode: "neural",
      type: "neural",
      category: "research",
      numResults: 5,
      contents: { text: true },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Exa API error (${response.status}): ${errorText}`);
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
}

async function lookupCrossref(
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

  if (items.length === 0) return { doi: null, publisher: null };

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

  if (scored.length === 0) return { doi: null, publisher: null };

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].item;
  const rawDoi = best.DOI as string | null | undefined;
  const doi = rawDoi?.trim() || null;
  const publisher =
    (best.publisher as string) ??
    (best["container-title"] as string[])?.[0] ??
    null;

  return { doi, publisher };
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

  let searchCount = 0;
  const MAX_SEARCHES = 3;
  let finalText: string | null = null;
  let exaRawResults: ExaResult[] = [];

  while (true) {
    const isFinalTurn = searchCount >= MAX_SEARCHES;
    const config: Record<string, unknown> = { ...commonConfig };

    if (isFinalTurn) {
      config.toolConfig = {
        functionCallingConfig: { mode: "NONE" },
      };
      config.responseMimeType = "application/json";
      config.responseJsonSchema = foundationalOracleResponseSchema;
    } else {
      config.tools = [exaSearchTool];
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: contents as Parameters<
        typeof ai.models.generateContent
      >[0]["contents"],
      config: config as Parameters<
        typeof ai.models.generateContent
      >[0]["config"],
    });

    const modelParts = response.candidates?.[0]?.content?.parts;
    if (!modelParts || modelParts.length === 0) {
      throw new Error(`Boş yanıt: ${box.title}`);
    }

    const functionCallPart = modelParts.find((p) => p.functionCall);

    if (
      functionCallPart?.functionCall?.args?.query &&
      searchCount < MAX_SEARCHES
    ) {
      searchCount++;
      const query = String(functionCallPart.functionCall.args.query);

      log.info("exa_search_round", {
        service: "boxes",
        data: { boxTitle: box.title, round: searchCount, query },
      });

      const rawResults = await searchExa(query);
      exaRawResults = rawResults;

      const sanitizedResults = rawResults.map((r) => ({
        title: r.title,
        author: r.author ?? null,
        publicationYear: r.publishedDate
          ? new Date(r.publishedDate).getFullYear()
          : null,
      }));

      contents.push({ role: "model", parts: modelParts });
      contents.push({
        role: "user",
        parts: [
          createPartFromFunctionResponse("0", "exa_academic_search", {
            results: sanitizedResults,
          }),
        ],
      });
    } else if (isFinalTurn) {
      const textPart = modelParts.find((p) => p.text);
      finalText = textPart?.text ?? response.text ?? null;
      if (!finalText) {
        throw new Error(`Model NONE modunda metin döndürmedi: ${box.title}`);
      }
      break;
    } else {
      contents.push({ role: "model", parts: modelParts });
      searchCount = MAX_SEARCHES;
    }
  }

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

  if (exaRawResults.length === 0) {
    log.warn("no_exa_results", {
      service: "boxes",
      data: { boxTitle: box.title },
    });
    return null;
  }

  const finalIdx = Math.max(0, Math.min(sIdx, exaRawResults.length - 1));
  const selectedResult = exaRawResults[finalIdx];

  const authorName = selectedResult.author || "Unknown Author";
  const pubYear = selectedResult.publishedDate
    ? new Date(selectedResult.publishedDate).getFullYear()
    : 0;

  // Crossref lookup
  const crossref = await lookupCrossref(selectedResult.title, authorName);

  return {
    flatIndex,
    foundationalQuery: {
      title: selectedResult.title,
      author: authorName,
      publicationYear: pubYear,
      doi: crossref.doi,
      publisher: crossref.publisher,
    },
  };
}
