import { ThinkingLevel } from "@google/genai";
import { getAi, retryOn503 } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type { GeminiThesisBox, FoundationalQuery } from "@/lib/types";
import {
  foundationalOracleResponseSchema,
  buildFoundationalOracleSystemInstruction,
  buildFoundationalOracleUserPrompt,
} from "@/lib/prompts";
import { searchExa, exaSearchTool, buildExaConfig } from "./exa-search";

interface CrossrefResult {
  doi: string | null;
  publisher: string | null;
  title: string | null;
  author: string | null;
  publicationYear: number | null;
}

function extractYear(item: Record<string, unknown>): number | null {
  const issued = item.issued as { "date-parts"?: number[][] } | undefined;
  const dateParts = issued?.["date-parts"]?.[0];
  if (dateParts?.[0]) return dateParts[0];
  return null;
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

  let items = await fetchWorks("query.title", title);
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

  const best = items[0];
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
  // Phase 1: Generate a single semantic search query
  // -------------------------------------------------------------------
  const queryConfig: Record<string, unknown> = {
    ...commonConfig,
    tools: [exaSearchTool],
  };

  const { result: phase1Response } = await retryOn503(
    () =>
      ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: contents as Parameters<
          typeof ai.models.generateContent
        >[0]["contents"],
        config: queryConfig as Parameters<
          typeof ai.models.generateContent
        >[0]["config"],
      }),
    3,
    1000,
    log,
  );

  const modelParts = phase1Response.candidates?.[0]?.content?.parts;
  if (!modelParts || modelParts.length === 0) {
    throw new Error(`Boş yanıt: ${box.title}`);
  }

  const functionCallPart = modelParts.find(
    (p: import("@google/genai").Part) => p.functionCall,
  );
  const query = functionCallPart?.functionCall?.args?.query
    ? String(functionCallPart.functionCall.args.query)
    : null;

  if (!query) {
    log.warn("no_query_generated", {
      service: "boxes",
      data: { boxTitle: box.title },
    });
    return null;
  }

  log.info("semantic_query_generated", {
    service: "boxes",
    data: { boxTitle: box.title, queryLength: query.length, query },
  });

  // -------------------------------------------------------------------
  // Phase 2: Single Exa search with the generated query
  // -------------------------------------------------------------------
  const boxType = box.boxType ?? "UNKNOWN";
  const researchScope = thesisMatrix.researchScope ?? "";

  const cfg = buildExaConfig(boxType, query, researchScope, log);
  cfg.query = query;

  log.info("exa_search_start", {
    service: "boxes",
    data: { boxTitle: box.title, boxType },
  });

  const searchStart = performance.now();
  const exaResults = await searchExa(cfg, query, log);
  log.info("exa_search_done", {
    service: "boxes",
    durationMs: performance.now() - searchStart,
    data: {
      boxTitle: box.title,
      resultCount: exaResults.length,
    },
  });

  if (exaResults.length === 0) {
    log.warn("no_exa_results", {
      service: "boxes",
      data: { boxTitle: box.title },
    });
    return null;
  }

  // -------------------------------------------------------------------
  // Phase 3: Present results to Gemini for final selection
  // -------------------------------------------------------------------
  const sanitized = exaResults.map((r) => ({
    title: r.title,
    author: r.author ?? null,
    publicationYear: r.publishedDate
      ? new Date(r.publishedDate).getFullYear()
      : null,
    url: r.url ?? null,
    textSnippet: r.text ? r.text.slice(0, 300) : null,
  }));

  const summaryLines: string[] = [];
  for (const r of sanitized) {
    const displayTitle = r.title || "(başlık boş)";
    summaryLines.push(
      `- ${displayTitle} (${r.author}, ${r.publicationYear ?? "Tarih yok"})`,
    );
    if (r.textSnippet) summaryLines.push(`  Özet: ${r.textSnippet}`);
  }

  contents.push({ role: "model", parts: modelParts });
  contents.push({
    role: "user",
    parts: [
      {
        text: `Arama sonuçları:\n${summaryLines.join("\n")}\n\nŞimdi en uygun kurucu eseri seç ve şemayı doldur.`,
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
  // Phase 4: Parse selection, sanity check, Crossref merge
  // -------------------------------------------------------------------
  let cleaned = finalText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();
  }

  const outputObj = JSON.parse(cleaned) as {
    selectedIndex: number;
    refinedTitle: string;
    refinedAuthor: string;
  };
  const sIdx = outputObj.selectedIndex;
  const finalIdx = Math.max(0, Math.min(sIdx, exaResults.length - 1));
  const selectedResult = exaResults[finalIdx];

  const isHallucinated = !selectedResult.title
    .toLowerCase()
    .split(/\s+/)
    .some(
      (word) =>
        word.length > 3 && outputObj.refinedTitle.toLowerCase().includes(word),
    );

  const safeTitle = isHallucinated
    ? selectedResult.title
    : outputObj.refinedTitle;

  const crossrefVerified = await lookupCrossref(
    safeTitle,
    outputObj.refinedAuthor,
  );

  const pubYear = selectedResult.publishedDate
    ? new Date(selectedResult.publishedDate).getFullYear()
    : 0;

  return {
    flatIndex,
    foundationalQuery: {
      title: crossrefVerified.title?.trim() || safeTitle,
      author: outputObj.refinedAuthor,
      publicationYear: crossrefVerified.publicationYear || pubYear,
      doi: crossrefVerified.doi,
      publisher: crossrefVerified.publisher,
    },
  };
}
