/**
 * Standardized Prompt Builder for Fabricca LLM System.
 * Strictly adheres to docs/LLM_INTEGRATION.md Sections 3 & 4 (Hybrid XML + Markdown Encapsulation).
 */

export interface PromptPayload {
  /**
   * Static system instructions, role, rules, workflow steps, and output format.
   * Placed first in LLM calls to optimize Implicit Caching.
   */
  systemInstruction: string;

  /**
   * Dynamic user input context and trigger task.
   */
  userPrompt: string;
}

export interface PromptBuilderInput {
  /** The persona, identity, and academic expertise of the model (<role> block). */
  roleAndExpertise: string;

  /** Clear, direct task description (# Birincil Görev within <instructions>). */
  primaryTask: string;

  /** Format, logic, and structural constraints (# Kurallar ve Sınırlamalar within <instructions>). */
  rulesAndConstraints: string;

  /** JSON schema constraints, language rules, output shape (# Çıktı Biçimi within <instructions>). */
  outputFormat: string;

  /** The dynamic runtime payload and user input data (<context> block). */
  inputContext: string;

  /** Optional step-by-step decision workflow (# İşlem Adımları within <instructions>). */
  workflowSteps?: string;

  /** Optional customized task trigger (<task> block). Defaults to standard trigger. */
  taskTrigger?: string;
}

/**
 * Global language guard injected into every prompt to prevent CJK leakage.
 * Gemini 3.5/3.6 Flash-Lite is multilingual; without an explicit ban the lite
 * tier occasionally emits Han characters in Turkish academic outputs.
 */
const LANGUAGE_GUARD =
  "**Dil Kilidi ve İmla Kuralları:** Tüm çıktı dili kesinlikle yüksek düzey akademik Türkçe olacaktır. " +
  "Girdi bağlamında İngilizce veya ASCII başlıklar/özetler yer alsa dahi, çıktıda Türkçe imla kurallarına ve Türkçe harflere (ç, ğ, ı, İ, ö, ş, ü) kesinlikle ve eksiksiz uyulmalıdır. İngilizce/ASCII harf yozlaşmasına (örneğin 'calismalar', 'yillarin', 'Incelenen' gibi) asla izin verilmez. " +
  "Çince, Japonca veya Korece karakter (Han/Kana/Hangul, \\u4E00-\\u9FFF, \\u3040-\\u30FF, \\uAC00-\\uD7AF) üretimi kesinlikle yasaktır. " +
  "Bu yasak JSON anahtarları ve değerleri dahil tüm çıktı için geçerlidir.";

/**
 * Builds a standardized, type-safe PromptPayload following the Hybrid XML and Markdown
 * encapsulation rules defined in docs/LLM_INTEGRATION.md Section 4 (Zero-Shot):
 *
 * <role>
 * [Role and Persona]
 * </role>
 *
 * <instructions>
 * # Birincil Görev
 * ...
 * # Kurallar ve Sınırlamalar
 * ...
 * # İşlem Adımları (opsiyonel)
 * ...
 * # Çıktı Biçimi
 * ...
 * </instructions>
 *
 * userPrompt:
 * <context>
 * [Dynamic Input Payload]
 * </context>
 *
 * <task>
 * [Trigger Task Instruction]
 * </task>
 *
 * @param input - Structural inputs for the prompt payload.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */

export function buildPromptPayload(input: PromptBuilderInput): PromptPayload {
  const instructionSections: string[] = [
    `# Birincil Görev\n${input.primaryTask.trim()}`,
    `# Kurallar ve Sınırlamalar\n${input.rulesAndConstraints.trim()}\n\n${LANGUAGE_GUARD}`,
  ];

  if (input.workflowSteps?.trim()) {
    instructionSections.push(`# İşlem Adımları\n${input.workflowSteps.trim()}`);
  }

  instructionSections.push(`# Çıktı Biçimi\n${input.outputFormat.trim()}`);

  const systemInstructionParts: string[] = [
    `<role>\n${input.roleAndExpertise.trim()}\n</role>`,
    `<instructions>\n${instructionSections.join("\n\n")}\n</instructions>`,
  ];

  const systemInstruction = systemInstructionParts.join("\n\n");

  const defaultTask =
    "Yukarıdaki <context> içeriğini <instructions> kurallarına göre analiz et ve çıktıyı üret.";
  const taskContent = input.taskTrigger?.trim() || defaultTask;

  const userPrompt = `<context>\n${input.inputContext.trim()}\n</context>\n\n<task>\n${taskContent}\n</task>`;

  return {
    systemInstruction,
    userPrompt,
  };
}
