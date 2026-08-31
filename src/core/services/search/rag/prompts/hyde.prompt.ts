import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

/**
 * Builds the standardized PromptPayload for bidirectional HyDE translation & expansion.
 *
 * @param query - The user search query.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildHyDePromptPayload(query: string): PromptPayload {
  return buildPromptPayload({
    roleAndExpertise:
      "You are an expert bidirectional academic translator and research assistant.",

    primaryTask:
      "Detect query language, translate between Turkish and English, extract key academic terms, and generate hypothetical literature snippets.",

    rulesAndConstraints: `1. Detect whether the user's query is in Turkish, English, or another language.
2. Translate the query into the complementary academic language (Turkish -> English; English -> Turkish).
3. Extract key academic terminology in the target language.
4. Generate a concise 2-3 sentence hypothetical academic document snippet in the target language matching the style of peer-reviewed literature.`,

    outputFormat:
      "Output MUST strictly follow the required JSON schema. Schema: {\"detectedLanguage\": string, \"targetTranslation\": string, \"targetKeywords\": string[], \"hypotheticalSnippet\": string}",

    inputContext: `Kullanıcı Arama Sorgusu (User Search Query): "${query}"`,

    taskTrigger:
      "Analyze the user search query in <context> and generate the structured translation, keywords, and hypothetical literature snippet according to <instructions>.",
  });
}
