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

    outputFormat: "Output MUST strictly follow the required JSON schema.",

    examples: `<example>
<input>
Kullanıcı Arama Sorgusu: "Siyasal iletişimde yapay zeka tabanlı kamuoyu analizi ve algı yönetimi"
</input>
<output>
{
  "detectedLanguage": "tr",
  "targetTranslation": "Artificial intelligence-based public opinion analysis and perception management in political communication",
  "targetKeywords": ["political communication", "artificial intelligence", "public opinion analysis", "perception management", "computational propaganda", "digital election campaigns"],
  "hypotheticalSnippet": "Contemporary political communication increasingly incorporates machine learning and sentiment analysis to monitor voter behavior in real-time. Automated text classification models enable political actors to identify emerging issue salience and strategically tailor campaign messaging to distinct demographic segments."
}
</output>
</example>

<example>
<input>
Kullanıcı Arama Sorgusu: "David Harvey urban accumulation and neoliberal governance"
</input>
<output>
{
  "detectedLanguage": "en",
  "targetTranslation": "David Harvey kentsel sermaye birikimi ve neoliberal yönetişim",
  "targetKeywords": ["David Harvey", "kentsel birikim", "neoliberalizm", "mekân üretimi", "yerel yönetimler", "kentsel rant"],
  "hypotheticalSnippet": "David Harvey'nin mekân üretimi ve sermayenin kentsel alana kayması kuramı, neoliberal dönemde yerel yönetimlerin girişimci bir karaktere bürünüşünü açıklamaktadır. Kentsel mekân, kamusal hizmet alanından ziyade sermaye birikiminin ve rant transferinin temel taşıyıcısı haline gelmiştir."
}
</output>
</example>`,

    inputContext: `Kullanıcı Arama Sorgusu (User Search Query): "${query}"`,

    taskTrigger:
      "Analyze the user search query in <context> and generate the structured translation, keywords, and hypothetical literature snippet according to <instructions>.",
  });
}
