import { z } from "zod";
import { generateCerebrasStructuredContent } from "@/services/ai";
import { CEREBRAS_MODEL } from "@/lib/constants";

const CHAT_TITLE_ZOD_SCHEMA = z.object({
  title: z
    .string()
    .describe(
      "3 ila 5 kelimelik, net, öz ve Türkçe bir akademik sohbet başlığı.",
    ),
});

const CHAT_TITLE_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "3 ila 5 kelimelik, net, öz ve Türkçe bir akademik sohbet başlığı.",
    },
  },
  required: ["title"],
  additionalProperties: false,
};

const CHAT_TITLE_SYSTEM_INSTRUCTION = `# Rol ve Uzmanlık

Sen bir akademik tez asistanısın.

# Birincil Görev

Kullanıcının sorduğu soruyu analiz ederek bu sohbet için 3 ila 5 kelimelik, net, öz ve Türkçe bir konu başlığı çıkar.

# Kurallar

1. Konu başlığını doğrudan 3-5 kelimelik yalın Türkçe isim tamlaması olarak yaz.
2. Yalnızca başlık metnini döndür (noktalama, tırnak veya açıklama içermeksizin).

# Örnekler

- David Romano Etnisite Yaklaşımı
- Primordiyalist Kuram Analizi
- Söylem Analizi Metodolojisi`;

/**
 * Generates a concise 3-5 word academic topic title using Cerebras Gemma 4 (gemma-4-31b).
 *
 * @param userQuery - The first user prompt query to derive the title from.
 * @returns The generated title string.
 * @throws When the model fails to produce a non-empty title.
 */
export async function generateChatTitle(userQuery: string): Promise<string> {
  const prompt = `Kullanıcı Sorusu: ${userQuery}`;

  const res = await generateCerebrasStructuredContent<{ title: string }>(
    CEREBRAS_MODEL,
    CHAT_TITLE_SYSTEM_INSTRUCTION,
    prompt,
    CHAT_TITLE_JSON_SCHEMA,
    undefined,
    {
      zodSchema: CHAT_TITLE_ZOD_SCHEMA,
      payloadStage: "advisor_chat_title",
    },
  );

  const title = res.title?.trim().slice(0, 100);
  if (!title) {
    throw new Error("Başlık üretilemedi.");
  }
  return title;
}
