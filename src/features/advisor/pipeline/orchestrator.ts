import { HarmCategory, HarmBlockThreshold, ThinkingLevel } from "@google/genai";
import { runStage1Audit } from "./stage1-audit";
import type { AuditReport, PipelineResult } from "./types";
import type { RagSearchResultItem } from "@/services/search/rag-search";
import { getAi } from "@/services/ai";
import { buildAdvisorTurnPromptPayload } from "../prompts/turn.prompt";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";

/** SSE event emission and text streaming interface used by the pipeline orchestrator. */
export interface PipelineSseWriter {
  send(type: string, payload: Record<string, unknown>): void;
  delta(text: string): void;
}

/** Inputs driving a single Heavy Flow pipeline turn. */
export interface PipelineTurnInput {
  userId: number;
  originalDraft: string;
}

/** Output produced by a full pipeline turn. */
export interface PipelineTurnOutput {
  text: string;
  sources: RagSearchResultItem[];
  pipeline: PipelineResult;
}

/**
 * Renders the Turkish findings list of a Stage 1 audit report.
 *
 * @param audit - The Stage 1 audit report.
 * @returns The rendered bulleted findings list, or the audit summary when empty.
 */
function formatAuditFindings(audit: AuditReport): string {
  if (audit.findings.length === 0) return audit.summary;

  const SEVERITY_LABELS: Record<string, string> = {
    CRITICAL: "Kritik",
    WARNING: "Uyarı",
    NOTE: "Not",
  };

  return audit.findings
    .map((finding) => {
      const label = SEVERITY_LABELS[finding.severity] ?? finding.severity;
      return `- **${label}:** ${finding.message}`;
    })
    .join("\n");
}

/**
 * Runs the Heavy Flow for a single chat turn: executes the Stage 1 strict audit
 * and applies the Strict Verification Gate. When critical issues are detected
 * the process halts immediately so the user can revise the draft, instead of
 * proceeding to any subsequent processing step.
 *
 * @param writer - The SSE writer.
 * @param input - The pipeline turn input containing the draft paragraph to audit.
 * @returns The turn output including the audit verdict text, grounded sources and pipeline result.
 */
export async function runPipelineTurn(
  writer: PipelineSseWriter,
  input: PipelineTurnInput,
): Promise<PipelineTurnOutput> {
  writer.send("stage_start", { stage: "audit" });
  const { audit, sources, sourceContext } = await runStage1Audit(
    input.userId,
    input.originalDraft,
  );
  writer.send("stage_done", { stage: "audit", payload: audit });

  const findingsText = formatAuditFindings(audit);
  const pipeline: PipelineResult = audit.hasCriticalIssues
    ? { stage: "audit", audit }
    : { stage: "audit" };

  if (audit.hasCriticalIssues) {
    // Strict Verification Gate: halt immediately, no subsequent steps.
    const text =
      "### Denetim Durduruldu — Kritik Bulgular\n\n" +
      "Taslak paragrafındaki kaynak atıflarında kritik uyumsuzluklar tespit edildi:\n\n" +
      findingsText +
      "\n\n> Devam etmeden önce bu bulguları gidermek için taslağınızı revize ederek yeniden gönderebilir veya onay vererek devam edebilirsiniz.";

    writer.delta(text);
    return { text, sources, pipeline };
  }

  // Audit passed — stream Socratic Advisor response
  try {
    const userMessageText = `Kütüphane Kaynak Bağlamı:\n${sourceContext}\n\nKullanıcı Taslağı:\n${input.originalDraft}`;
    const payload = buildAdvisorTurnPromptPayload("SOCRATIC_ADVISOR", userMessageText);
    const ai = getAi();
    const contents = [
      {
        role: "user",
        parts: [
          {
            text: payload.userPrompt,
          },
        ],
      },
    ];

    let fullText = "";

    const stream = await ai.models.generateContentStream({
      model: FLASH_LITE_35,
      contents: contents as unknown as Parameters<
        typeof ai.models.generateContentStream
      >[0]["contents"],
      config: {
        systemInstruction: payload.systemInstruction,
        seed: GEMINI_SEED,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
        ],
      },
    });

    for await (const chunk of stream) {
      let text = "";
      try {
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (part.text) text += part.text;
          }
        } else {
          text = chunk.text ?? "";
        }
      } catch {
        text = "";
      }

      if (text) {
        fullText += text;
        writer.delta(text);
      }
    }

    return { text: fullText, sources, pipeline };
  } catch {
    // Fallback: brief acknowledgment if Socratic generation fails
    const fallbackText =
      "### Denetim Başarılı\n\n" +
      "Taslak paragrafınız kaynak ve alıntı doğruluğu açısından denetlendi; " +
      "kritik düzeyde bir tutarsızlık tespit edilmedi.\n\n" +
      "Şimdi tezinizin metodolojik çerçevesini ve teorik temellerini eleştirel bir şekilde değerlendirelim: " +
      "Bu taslağınızda kullandığınız kaynakları hangi ölçüte göre seçtiniz ve neden bu kaynakları diğer alternatiflerin üzerine tercih ettiniz?";

    writer.delta(fallbackText);
    return { text: fallbackText, sources, pipeline };
  }
}
