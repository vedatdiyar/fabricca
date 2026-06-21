"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisBoxes } from "@/db/schema";
import { getSession } from "@/session";
import {
  generateStructuredContent,
  getAi,
  sanitizeAndParseJson,
} from "@/lib/gemini";
import { ThinkingLevel, Type, FunctionCallingConfigMode } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath, updateTag } from "next/cache";
import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts/box-generation";
import {
  buildFoundationalQuerySystemInstruction,
  buildFoundationalQueryPrompt,
} from "@/lib/prompts/foundational-queries";
import {
  BoxGenerationResponseSchema,
  FinalBoxGenerationResponseSchema,
  RefinedFoundationalQueriesSchema,
  type GeminiThesisBox,
  type FoundationalQuery,
  type OnboardingActionResult,
} from "@/lib/types";
import { fetchThesisMatrix } from "../_lib/fetch-actions";

/**
 * Calls the Exa API to search for research papers.
 *
 * @param query - The optimized query to send to Exa.
 * @param log - Logger instance for error reporting.
 * @returns Array of title, url and highlights.
 */
async function searchExa(
  query: string,
  log: Logger,
): Promise<Array<{ title: string; url: string; highlights: string[] }>> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY environment variable is not defined");
  }

  const cleanQuery = query
    .replace(/\b(AND|OR|NOT)\s+/gi, "")
    .replace(/[""]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: cleanQuery,
      numResults: 5,
      type: "auto",
      category: "research paper",
      contents: {
        highlights: true,
        maxAgeHours: -1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error("exa_api_call_failed", {
      service: "boxes",
      data: { query, status: response.status, errorText },
      error: new Error(`Exa API error: ${response.statusText}`),
    });
    throw new Error(
      `Exa API returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    results?: Array<{
      title: string;
      url: string;
      highlights: string[];
    }>;
    costDollars?: number;
  };

  console.log(
    "[TEST LOG] Exa API Raw JSON Response:",
    JSON.stringify(data, null, 2),
  );
  console.log(
    `[TEST LOG] Exa costDollars total: ${data.costDollars != null ? (data.costDollars as unknown as { total: number }).total : "N/A"}`,
  );

  return data.results || [];
}

/**
 * Two-step sequential hybrid pipeline for thesis box generation.
 *
 * Step 1 (Gemini 3.1 Flash Lite): Splits the thesis matrix into subject boxes
 * (schema-locked JSON mode — no foundational queries).
 *
 * Step 2 (Gemini 3.1 Flash Lite + Exa API Function Calling): For each box,
 * runs an Exa Search via native Tool/Function Calling, then sifts and refines the results.
 *
 * @returns The fully populated thesis boxes array, or a user-safe error message
 */
export async function generateBoxesAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const pipelineStart = performance.now();

  try {
    const session = await getSession();
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Box splitting via Gemini 3.1 Flash Lite (structured JSON)
    // ─────────────────────────────────────────────────────────────
    log.info("step1_split_start", {
      service: "boxes",
      data: { context: "Kutu bölme (3.1 Flash Lite)" },
    });

    const step1Start = performance.now();
    const geminiPrompt = buildThesisBoxGenerationPrompt({
      studyTitle: matrix.studyTitle,
      researchQuestion: matrix.researchQuestion,
      mainClaim: matrix.mainClaim,
      theoreticalFramework: matrix.theoreticalFramework,
      methodology: matrix.methodology,
      researchScope: matrix.researchScope,
    });

    const generationResult = await generateStructuredContent<{
      boxes: Array<Omit<GeminiThesisBox, "foundationalQueries">>;
    }>(
      "gemini-3.1-flash-lite",
      buildThesisBoxGenerationSystemInstruction(),
      geminiPrompt,
      thesisBoxGenerationSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        zodSchema: BoxGenerationResponseSchema,
      },
    );

    const partialBoxes = generationResult.boxes;

    // Ensure all partialBoxes have boxType mapped correctly (fallback from type if model returned type)
    const normalizedPartialBoxes = partialBoxes.map((box) => {
      const rawBox = box as Omit<GeminiThesisBox, "foundationalQueries"> & {
        type?: string;
      };
      const boxType = rawBox.boxType || rawBox.type;
      return {
        title: rawBox.title || "",
        boxType: boxType as
          | "PROBLEMATIZATION"
          | "CONCEPTUAL"
          | "DATA_PROTOCOL"
          | "ANALYSIS_FINDINGS",
        description: rawBox.description || "",
        semanticSearchBlock: rawBox.semanticSearchBlock || "",
        concepts: rawBox.concepts || [],
      };
    });

    log.info("step1_split_success", {
      service: "boxes",
      durationMs: performance.now() - step1Start,
      data: { count: normalizedPartialBoxes.length, context: "Kutu bölme" },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Foundational query enrichment via Gemini 3.1 Flash-Lite + Exa Function Calling
    // ─────────────────────────────────────────────────────────────
    log.info("step2_search_start", {
      service: "boxes",
      data: {
        boxCount: normalizedPartialBoxes.length,
        context:
          "Paralel literatür arama (3.1 Flash-Lite + Exa Function Calling)",
      },
    });

    const step2Start = performance.now();

    const enrichedBoxes: GeminiThesisBox[] = await Promise.all(
      normalizedPartialBoxes.map(async (box) => {
        // ANALYSIS_FINDINGS (Arşiv) kontrolünü tool calling tetiklemesinden önce yap
        if (box.boxType === "ANALYSIS_FINDINGS") {
          console.log(
            `[TEST LOG] ANALYSIS_FINDINGS detected. Skipping search, returning empty array.`,
          );
          return {
            title: box.title,
            boxType: box.boxType,
            description: box.description,
            semanticSearchBlock: box.semanticSearchBlock,
            concepts: box.concepts,
            foundationalQueries: [],
          };
        }

        const systemInstruction = buildFoundationalQuerySystemInstruction();
        const userPrompt = buildFoundationalQueryPrompt(box);

        try {
          const ai = getAi();

          // 1) Define function tool for executeExaSearch
          const executeExaSearchDeclaration = {
            name: "executeExaSearch",
            description:
              "Executes a search on Exa API to find foundational and seminal academic literature (research papers, books) for a topic.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                query: {
                  type: Type.STRING,
                  description:
                    "Optimized search query in English academic language (e.g. key authors and seminal concepts) to find foundational literature for the topic box. Must not be empty.",
                },
                category: {
                  type: Type.STRING,
                  enum: ["research paper"],
                  description: "Filter to restrict results to research papers.",
                },
                highlights: {
                  type: Type.BOOLEAN,
                  description: "Request highlights of matching content.",
                },
              },
              required: ["query", "category", "highlights"],
            },
          };

          log.info("step2_tool_call_start", {
            service: "boxes",
            data: {
              boxTitle: box.title,
              context: "Function calling başlatıldı",
            },
          });

          // 2) First Gemini call to get the function call configuration
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: [executeExaSearchDeclaration] }],
              toolConfig: {
                functionCallingConfig: {
                  mode: FunctionCallingConfigMode.ANY,
                },
              },
              temperature: 1.0,
            },
          });

          const functionCall = response.functionCalls?.[0];
          console.log(
            `[TEST LOG] Gemini Function Call Object for "${box.title}":`,
            JSON.stringify(functionCall, null, 2),
          );

          if (!functionCall || functionCall.name !== "executeExaSearch") {
            log.error("step2_tool_call_invalid", {
              service: "boxes",
              error: new Error(
                "Model executeExaSearch fonksiyon çağrısı üretmedi.",
              ),
              data: { boxTitle: box.title },
            });
            return {
              title: box.title,
              boxType: box.boxType,
              description: box.description,
              semanticSearchBlock: box.semanticSearchBlock,
              concepts: box.concepts,
              foundationalQueries: [],
            };
          }

          const args = functionCall.args as {
            query?: string;
            category?: string;
            highlights?: boolean;
          };
          const query = args.query?.trim();

          // Validate that the query is not empty before executing
          if (!query) {
            log.error("step2_query_empty", {
              service: "boxes",
              error: new Error("Modelin ürettiği query parametresi boş geldi."),
              data: { boxTitle: box.title, args },
            });
            return {
              title: box.title,
              boxType: box.boxType,
              description: box.description,
              semanticSearchBlock: box.semanticSearchBlock,
              concepts: box.concepts,
              foundationalQueries: [],
            };
          }

          log.info("step2_exa_search_start", {
            service: "boxes",
            data: { boxTitle: box.title, query },
          });

          // 3) Call Exa API
          const searchResults = await searchExa(query, log);

          log.info("step2_exa_search_success", {
            service: "boxes",
            data: { boxTitle: box.title, resultCount: searchResults.length },
          });

          const modelContent = response.candidates?.[0]?.content;
          if (!modelContent) {
            throw new Error("Model response content is missing.");
          }

          console.log(`[TEST LOG] Second Turn Handshake for "${box.title}":`, {
            functionCallId: functionCall.id,
            functionResponseId: functionCall.id,
            match: true,
          });

          // 4) Second Gemini call: Feed back results to model mapping the unique ID
          const contents = [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
            // Append the model's function call content
            modelContent,
            // Append the function response mapping the exact functionCall.id
            {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: functionCall.name,
                    id: functionCall.id,
                    response: {
                      results: searchResults,
                    },
                  },
                },
              ],
            },
          ];

          // 5) Retrieve the final structured response (vanilla JSON Schema)
          const refinedFoundationalQueriesJsonSchema = {
            type: "object",
            properties: {
              foundationalQueries: {
                type: "array",
                description:
                  "Bulunan en kaliteli 2 ila 4 adet kurucu akademik eserin listesi.",
                items: {
                  type: "object",
                  properties: {
                    author: {
                      type: "string",
                      description: "Yazarın gerçek tam adı.",
                    },
                    title: {
                      type: "string",
                      description: "Eserin orijinal başlığı.",
                    },
                    publicationYear: {
                      type: "integer",
                      description: "Eserin yayın yılı (sayısal).",
                    },
                  },
                  required: ["author", "title", "publicationYear"],
                },
              },
            },
            required: ["foundationalQueries"],
          };

          log.info("step2_refinement_start", {
            service: "boxes",
            data: { boxTitle: box.title },
          });

          const finalResponse = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents,
            config: {
              systemInstruction,
              temperature: 1.0,
              responseMimeType: "application/json",
              responseJsonSchema: refinedFoundationalQueriesJsonSchema,
            },
          });

          const text = finalResponse.text;
          if (!text) {
            throw new Error("Süzme adımında modelden boş yanıt döndü.");
          }

          const parsed = sanitizeAndParseJson<{
            foundationalQueries: FoundationalQuery[];
          }>(text);

          console.log(
            `[TEST LOG] Parsed structured JSON for "${box.title}" before Zod check:`,
            JSON.stringify(parsed, null, 2),
          );

          // Validate using Zod schema RefinedFoundationalQueriesSchema
          const validation = RefinedFoundationalQueriesSchema.safeParse(parsed);
          if (!validation.success) {
            console.log(
              `[TEST LOG] Zod Validation FAILED for "${box.title}":`,
              JSON.stringify(validation.error.issues, null, 2),
            );
            log.error("step2_refinement_validation_failed", {
              service: "boxes",
              error: new Error("Structured output validation failed"),
              data: { boxTitle: box.title, issues: validation.error.issues },
            });
            return {
              title: box.title,
              boxType: box.boxType,
              description: box.description,
              semanticSearchBlock: box.semanticSearchBlock,
              concepts: box.concepts,
              foundationalQueries: [],
            };
          }

          const queries = validation.data.foundationalQueries;
          console.log(
            `[TEST LOG] Zod Validation Success for "${box.title}":`,
            JSON.stringify(queries, null, 2),
          );
          return {
            title: box.title,
            boxType: box.boxType,
            description: box.description,
            semanticSearchBlock: box.semanticSearchBlock,
            concepts: box.concepts,
            foundationalQueries: queries,
          };
        } catch (err) {
          log.error("step2_box_enrichment_failed", {
            service: "boxes",
            error: err,
            data: { boxTitle: box.title },
          });
          return {
            title: box.title,
            boxType: box.boxType,
            description: box.description,
            semanticSearchBlock: box.semanticSearchBlock,
            concepts: box.concepts,
            foundationalQueries: [],
          };
        }
      }),
    );

    log.info("step2_search_success", {
      service: "boxes",
      durationMs: performance.now() - step2Start,
      data: {
        boxCount: enrichedBoxes.length,
        context: "Paralel literatür arama tamamlandı",
      },
    });

    // ─────────────────────────────────────────────────────────────
    // POST-PROCESSING: Global deduplication + final validation
    // ─────────────────────────────────────────────────────────────
    const dedupedBoxes = deduplicateFoundationalQueries(enrichedBoxes);

    const validationResult = FinalBoxGenerationResponseSchema.safeParse({
      boxes: dedupedBoxes,
    });

    if (!validationResult.success) {
      log.error("step2_validation_failed", {
        service: "boxes",
        error: new Error(validationResult.error.message),
        data: {
          issues: validationResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
          context: "Final validasyon",
        },
      });
      return {
        error:
          "Kutulardaki kurucu literatür verisi doğrulamayı geçemedi. Lütfen tekrar deneyin.",
      };
    }

    log.info("pipeline_complete", {
      service: "boxes",
      durationMs: performance.now() - pipelineStart,
      data: {
        boxCount: dedupedBoxes.length,
        context: "İki aşamalı kutu üretimi tamamlandı",
      },
    });

    return { success: true, boxes: dedupedBoxes };
  } catch (err) {
    log.error("pipeline_failed", {
      service: "boxes",
      error: err,
      data: { context: "Kutu üretim pipeline hatası" },
    });
    return {
      error: "Konu kutuları oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Removes duplicate foundational queries across all boxes based on
 * author+title key. If a work was already assigned to an earlier box,
 * it is filtered out from subsequent boxes.
 */
function deduplicateFoundationalQueries(
  boxes: GeminiThesisBox[],
): GeminiThesisBox[] {
  const seen = new Set<string>();

  return boxes.map((box) => {
    const uniqueQueries = box.foundationalQueries.filter((q) => {
      const key = `${q.author}|${q.title}`.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    return { ...box, boxType: box.boxType, foundationalQueries: uniqueQueries };
  });
}

/**
 * Persists the generated (and possibly user-edited) subject boxes to thesis_boxes.
 * Deletes existing boxes for the matrix first, then inserts flat hierarchy.
 *
 * @param boxes - Array of GeminiThesisBox to persist
 * @returns Success or error response
 */
export async function confirmBoxesAction(
  boxes: GeminiThesisBox[],
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("boxes_confirm_start", {
    service: "boxes",
    data: { context: "Konu kutusu kaydetme" },
  });

  try {
    const session = await getSession();
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const thesisMatrixId = matrix.id;

    await db.transaction(async (tx) => {
      // Delete existing boxes
      await tx
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

      // Insert all boxes as flat
      const boxValues = boxes.map((box) => ({
        thesisMatrixId,
        title: box.title,
        boxType: box.boxType,
        description: box.description || "",
        semanticSearchBlock: box.semanticSearchBlock || "",
        foundationalQueries: box.foundationalQueries || [],
        concepts: box.concepts || [],
      }));

      if (boxValues.length > 0) {
        await tx.insert(thesisBoxes).values(boxValues);
      }
    });

    revalidatePath("/onboarding", "layout");
    revalidatePath("/onboarding/literature-review");
    revalidatePath("/", "layout");

    updateTag("thesis-boxes");

    log.info("boxes_confirm_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: { count: boxes.length, context: "Konu kutusu kaydetme" },
    });
    return { success: true };
  } catch (err) {
    log.error("boxes_confirm_failed", {
      service: "boxes",
      error: err,
      data: { context: "Konu kutusu kaydetme" },
    });
    return { error: "Konu kutuları kaydedilirken bir hata oluştu." };
  }
}
