/**
 * Standardized Prompt Builder for Fabricca LLM System.
 * Strictly adheres to docs/LLM_INTEGRATION.md Sections 3 & 4 (Hybrid XML + Markdown Encapsulation).
 */

export interface PromptPayload {
  /**
   * Static system instructions, role, rules, workflow steps, output format, and few-shot examples.
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

  /** Optional intra-disciplinary few-shot examples (<examples> block with <example><input>...</input><output>...</output></example>). */
  examples?: string;

  /** Optional customized task trigger (<task> block). Defaults to standard trigger. */
  taskTrigger?: string;
}

/**
 * Builds a standardized, type-safe PromptPayload following the Hybrid XML and Markdown
 * encapsulation rules defined in docs/LLM_INTEGRATION.md Section 4:
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
 * <examples> (opsiyonel)
 * <example>
 * <input>...</input>
 * <output>...</output>
 * </example>
 * </examples>
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
    `# Kurallar ve Sınırlamalar\n${input.rulesAndConstraints.trim()}`,
  ];

  if (input.workflowSteps?.trim()) {
    instructionSections.push(
      `# İşlem Adımları\n${input.workflowSteps.trim()}`,
    );
  }

  instructionSections.push(`# Çıktı Biçimi\n${input.outputFormat.trim()}`);

  const systemInstructionParts: string[] = [
    `<role>\n${input.roleAndExpertise.trim()}\n</role>`,
    `<instructions>\n${instructionSections.join("\n\n")}\n</instructions>`,
  ];

  if (input.examples?.trim()) {
    const trimmedExamples = input.examples.trim();
    if (
      trimmedExamples.startsWith("<examples>") &&
      trimmedExamples.endsWith("</examples>")
    ) {
      systemInstructionParts.push(trimmedExamples);
    } else {
      systemInstructionParts.push(`<examples>\n${trimmedExamples}\n</examples>`);
    }
  }

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
