import {
  generateStructuredContent,
  type JsonSchema,
} from "@/lib/services/gemini";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { Logger } from "@/lib/logger";
import { z } from "zod";

export interface CandidateWork {
  title: string;
  authors: string;
  year: number | null;
  openAlexId: string;
  doi: string | null;
  publisher: string | null;
}

export interface BulkSelectionResult {
  selections: {
    subBoxTitle: string;
    selectedIndex: number;
    reasoning: string;
  }[];
}

const bulkSelectSchema: JsonSchema = {
  type: "object",
  properties: {
    selections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subBoxTitle: { type: "string" },
          selectedIndex: {
            type: "integer",
            description:
              "Selected candidate index (0-based) from that sub-box candidates list",
          },
          reasoning: {
            type: "string",
            description:
              "Brief reasoning in Turkish explaining the choice (shown to the user in the UI).",
          },
        },
        required: ["subBoxTitle", "selectedIndex", "reasoning"],
      },
    },
  },
  required: ["selections"],
};

const zodBulkSelectSchema = z.object({
  selections: z.array(
    z.object({
      subBoxTitle: z.string(),
      selectedIndex: z.number().int().min(0),
      reasoning: z.string().min(1),
    }),
  ),
});

const BULK_FOUNDATIONAL_JURY_PROMPT = `# Rol ve Uzmanlık
Tez alt kutuları için en uygun "Temel Eser" (Foundational Work) seçimini yapan uzman akademik kurul üyesi ve literatür ve araştırma uzmanısınız.

# Seçim Kuralları ve Strateji
1. CONCEPTUAL (Kavramsal) Kutusu: Kuramsal çerçeveyi kuran birincil orijinal kaynağı seçin. Orijinal birincil eser adaylar arasındayken asla ikincil yorumları, eleştirileri veya uygulamalı çalışmaları seçmeyin.
2. PROBLEMATIZATION / CONTEXT / DATA_PROTOCOL Kutuları: Kutu başlığı ve açıklamasıyla doğrudan örtüşen ampirik çalışmaları, saha araştırmalarını, tarihsel analizleri veya metodolojik mihenk taşlarını seçin. Soyut genel teorik eserleri bu kutular için seçmeyin.
3. Dil Tercihi: İngilizce veya Türkçe yazılmış eserleri tercih edin.
4. Küresel Sıralı Tekilleştirme (Deduplication): Seçimleri sırayla yapın (Alt Kutu [0] -> [1] -> [2]...). Önceki alt kutular için seçilmiş olan bir eseri mevcut aday listesinde görünse dahi kesinlikle tekrar seçmeyin.

# Çıktı Biçimi
- Her alt kutu için subBoxTitle, selectedIndex (0 tabanlı) ve Türkçe gerekçe (reasoning) içeren JSON döndürün.`;

/**
 * Calls Gemini to select the most appropriate foundational work for
 * multiple sub-boxes simultaneously. Uses ThinkingLevel.LOW for optimized
 * performance and global deduplication.
 *
 * @param subBoxes - List of sub-boxes along with their compiled candidates
 * @param logger - Optional Logger instance for structured LLM call logging
 * @returns Object mapping each sub-box title to its selected candidate
 *          index and selection reasoning (in Turkish for UI display)
 */
export async function selectFoundationalWorksBulk(
  subBoxes: {
    title: string;
    boxType: string;
    description: string;
    candidates: CandidateWork[];
  }[],
  logger?: Logger,
): Promise<BulkSelectionResult> {
  if (subBoxes.length === 0) {
    return { selections: [] };
  }

  const promptParts = subBoxes
    .map((subBox, sbIdx) => {
      return `Sub-Box [${sbIdx}]:
Title: ${subBox.title}
Box Type: ${subBox.boxType}
Description: ${subBox.description ?? ""}

Candidate Works:
${subBox.candidates.map((c, idx) => `${idx}. [${c.year}] "${c.title}" - Author(s): ${c.authors}`).join("\n")}
`;
    })
    .join("\n---\n\n");

  const prompt = `# Girdi Bağlamı
${promptParts}

# Birincil Görev
Yukarıdaki bağlamda yer alan her bir alt kutu için belirtilen seçim ve tekilleştirme kurallarına göre en uygun temel eseri seçin ve sonucu JSON formatında döndürün.`;

  const result = await generateStructuredContent<BulkSelectionResult>(
    FLASH_LITE_31,
    BULK_FOUNDATIONAL_JURY_PROMPT,
    prompt,
    bulkSelectSchema,
    logger,
    {
      seed: GEMINI_SEED,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      zodSchema: zodBulkSelectSchema,
      payloadStage: "literature_bulk_foundational_selection",
      quiet: true,
    },
  );

  return result;
}
