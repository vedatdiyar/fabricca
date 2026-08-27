import { z } from "zod";
import { getAi } from "@/core/services/ai";
import { dispatchGeminiCall } from "@/core/services/ai/gemini-scheduler";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import type { ThesisMatrix } from "@/lib/types";

export interface ChatMessageLike {
  role: "user" | "model";
  content: string;
}

/**
 * Deterministically parses markdown blockquotes and headers from chat history
 * looking for crystallized matrix quadrant quotes (e.g. `> **Teorik ve Kavramsal Çerçeve:** ...`).
 */
export function extractMatrixFromChatRegex(
  messages: ChatMessageLike[],
  currentMatrix: Partial<ThesisMatrix> = {},
): Partial<ThesisMatrix> {
  const result: Partial<ThesisMatrix> = {
    subjectProblem: currentMatrix.subjectProblem?.trim() || "",
    theoreticalFramework: currentMatrix.theoreticalFramework?.trim() || "",
    primaryMaterial: currentMatrix.primaryMaterial?.trim() || "",
    methodology: currentMatrix.methodology?.trim() || "",
  };

  // Inspect all advisor/model messages in chronological order
  for (const msg of messages) {
    if (msg.role !== "model" && msg.role !== "user") continue;
    const content = msg.content;

    // Pattern 1: `> **[Label]:** [Content]` or `> **[Label]**: [Content]`
    const blockquoteRegex = />\s*\*\*([^*]+)\*\*:?\s*([\s\S]+?)(?=\n\n|\n>|\n#|$)/g;
    let match: RegExpExecArray | null;

    while ((match = blockquoteRegex.exec(content)) !== null) {
      const rawLabel = match[1].toLowerCase().trim();
      const rawValue = match[2]
        .replace(/^>\s*/gm, "")
        .replace(/\n\s*Matris tamamlandı.*$/i, "")
        .trim();

      if (
        rawValue.length >= 30 &&
        !rawValue.toLowerCase().includes("[bekliyor") &&
        !rawValue.toLowerCase().includes("[eksik")
      ) {
        if (
          rawLabel.includes("araştırma problemi") ||
          rawLabel.includes("problem") ||
          rawLabel.includes("aktörler") ||
          rawLabel.includes("odak")
        ) {
          result.subjectProblem = rawValue;
        } else if (
          rawLabel.includes("teorik") ||
          rawLabel.includes("kuramsal") ||
          rawLabel.includes("kavramsal çerçeve")
        ) {
          result.theoreticalFramework = rawValue;
        } else if (
          rawLabel.includes("veri kaynağı") ||
          rawLabel.includes("birincil malzeme") ||
          rawLabel.includes("veri seti") ||
          rawLabel.includes("malzeme")
        ) {
          result.primaryMaterial = rawValue;
        } else if (
          rawLabel.includes("metodoloji") ||
          rawLabel.includes("yöntem") ||
          rawLabel.includes("analiz yöntemi")
        ) {
          result.methodology = rawValue;
        }
      }
    }
  }

  return result;
}

const matrixExtractionSchema = z.object({
  subjectProblem: z.string().optional().default(""),
  theoreticalFramework: z.string().optional().default(""),
  primaryMaterial: z.string().optional().default(""),
  methodology: z.string().optional().default(""),
});

/**
 * Intelligent LLM-powered matrix harvester that reads the entire dialogue history
 * and synthesizes/recovers crystallized academic quadrants without hallucinating unreached fields.
 */
export async function extractMatrixFromChatLlm(
  messages: ChatMessageLike[],
  currentMatrix: Partial<ThesisMatrix> = {},
): Promise<Partial<ThesisMatrix>> {
  if (messages.length < 2) {
    return currentMatrix;
  }

  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Araştırmacı" : "Danışman"}: ${m.content}`)
    .join("\n\n---\n\n");

  const prompt = `<role>
Akademik Tez Matrisi Ekstraksiyon ve Derleme Uzmanısınız.
Göreviniz; Danışman ile Araştırmacı arasındaki müzakere geçmişini dikkatle okuyarak uzlaşılan veya mühürlenen matris kadranlarını eksiksiz akademik Türkçe metinler olarak derlemektir.
</role>

<instructions>
1. Aşağıdaki konuşma geçmişini baştan sona inceleyin.
2. Danışmanın mühürlediği (> **0X. [Alan]:** ...) veya araştırmacıyla üzerinde tam mutabakata varılmış her bir kadranın en olgun akademik halini ilgili alana yazın.
3. Alanlar:
   - subjectProblem: 01. Araştırma Problemi, Aktörler ve Odak (Hangi problem, hangi aktörler, hangi çatışma/boşluk inceleniyor?)
   - theoreticalFramework: 02. Teorik ve Kavramsal Çerçeve (Kullanılan temel kuramlar, kavramsal model, analitik paradigma)
   - primaryMaterial: 03. Veri Kaynağı / Birincil Malzeme (İncelenecek somut arşivler, veri tabanları, belgeler, saha örneklemi)
   - methodology: 04. Metodoloji ve Analiz Yöntemi (Araştırma deseni, analiz tekniği, operasyonelleştirme, kodlama stratejisi)
4. KRİTİK KURAL (SIFIR HALÜSİNASYON):
   - Eğer bir alan sohbette henüz müzakere edilmediyse, araştırmacı o aşamaya henüz gelmediyse veya danışman tarafından açıkça mühürlenmediyse KESİNLİKLE boş string ("") bırakın!
   - ASLA kafanızdan genel geçer tez metinleri, şablon cümleler veya varsayımlar UYDURMAYIN.
   - Sadece sohbette gerçekten var olan, müzakere edilmiş ve olgunlaşmış kadranları derleyin.
5. Halihazırda mevcut olan değerler (${JSON.stringify(currentMatrix)}) zaten doğruysa onları koruyun veya sohbette daha olgun bir versiyon varsa onunla güncelleyin.
</instructions>

<conversation>
${conversationText}
</conversation>

Çıktıyı JSON formatında verin. Konuşulmamış kadranlar için mutlaka boş string ("") döndürün.`;

  try {
    const response = await dispatchGeminiCall({
      model: FLASH_LITE_35,
      task: async ({ model, apiKey }) => {
        const ai = getAi(apiKey);
        return ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            seed: GEMINI_SEED,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                subjectProblem: { type: "string" },
                theoreticalFramework: { type: "string" },
                primaryMaterial: { type: "string" },
                methodology: { type: "string" },
              },
            },
          },
        });
      },
    });

    const jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) return currentMatrix;

    const parsed = matrixExtractionSchema.safeParse(JSON.parse(jsonText));
    if (!parsed.success) return currentMatrix;

    const extracted = parsed.data;

    const isCleanQuadrant = (text: string | undefined): string => {
      if (!text) return "";
      const trimmed = text.trim();
      const lower = trimmed.toLowerCase();
      if (
        trimmed.length < 35 ||
        lower.includes("boş bırakıl") ||
        lower.includes("henüz mühürlen") ||
        lower.includes("müzakere edil") ||
        lower.includes("belirtilme") ||
        lower.includes("konuşulma") ||
        lower.includes("tartışılma") ||
        lower.includes("bekliyor")
      ) {
        return "";
      }
      return trimmed;
    };

    return {
      subjectProblem:
        isCleanQuadrant(extracted.subjectProblem) ||
        currentMatrix.subjectProblem?.trim() ||
        "",
      theoreticalFramework:
        isCleanQuadrant(extracted.theoreticalFramework) ||
        currentMatrix.theoreticalFramework?.trim() ||
        "",
      primaryMaterial:
        isCleanQuadrant(extracted.primaryMaterial) ||
        currentMatrix.primaryMaterial?.trim() ||
        "",
      methodology:
        isCleanQuadrant(extracted.methodology) ||
        currentMatrix.methodology?.trim() ||
        "",
    };
  } catch {
    return currentMatrix;
  }
}

/**
 * Unified multi-stage harvester:
 * 1. Runs deterministic fast regex parsing.
 * 2. If any quadrant remains unsealed (< 20 chars), invokes LLM synthesis from conversation.
 */
export async function harvestMatrixFromChat(
  messages: ChatMessageLike[],
  currentMatrix: Partial<ThesisMatrix> = {},
): Promise<Partial<ThesisMatrix>> {
  // Step 1: Deterministic regex parsing
  let merged = extractMatrixFromChatRegex(messages, currentMatrix);

  // Check if any quadrant is still missing
  const isQ1Done = Boolean(merged.subjectProblem && merged.subjectProblem.length >= 20);
  const isQ2Done = Boolean(merged.theoreticalFramework && merged.theoreticalFramework.length >= 20);
  const isQ3Done = Boolean(merged.primaryMaterial && merged.primaryMaterial.length >= 20);
  const isQ4Done = Boolean(merged.methodology && merged.methodology.length >= 20);

  const completedCount = [isQ1Done, isQ2Done, isQ3Done, isQ4Done].filter(Boolean).length;

  // Step 2: If incomplete and messages exist, run fast LLM synthesis
  if (completedCount < 4 && messages.length >= 2) {
    const llmExtracted = await extractMatrixFromChatLlm(messages, merged);
    merged = {
      subjectProblem: llmExtracted.subjectProblem || merged.subjectProblem || "",
      theoreticalFramework: llmExtracted.theoreticalFramework || merged.theoreticalFramework || "",
      primaryMaterial: llmExtracted.primaryMaterial || merged.primaryMaterial || "",
      methodology: llmExtracted.methodology || merged.methodology || "",
    };
  }

  return merged;
}
