/**
 * Standardized Prompt Builder for Fabricca LLM System.
 * Strictly adheres to docs/LLM_INTEGRATION.md Section 3 & 4.
 */

export interface PromptPayload {
  /**
   * Static system instructions, roles, rules, workflow steps, and output format.
   * Placed first in LLM calls to optimize Implicit Caching.
   */
  systemInstruction: string;

  /**
   * Dynamic user input context, parameters, and dynamic runtime payload.
   */
  userPrompt: string;
}

export interface PromptBuilderInput {
  /** # Rol ve Uzmanlık: The persona, identity, and academic expertise of the model. */
  roleAndExpertise: string;

  /** # Birincil Görev: Clear, direct task description. */
  primaryTask: string;

  /** # Kurallar ve Sınırlamalar: Format, logic, structural constraints. */
  rulesAndConstraints: string;

  /** # Çıktı Biçimi: JSON schema constraints, language rules, output shape. */
  outputFormat: string;

  /** # Girdi Bağlamı ve Veri: The dynamic runtime payload and user input data. */
  inputContext: string;

  /** # İşlem Adımları: Optional step-by-step decision workflow. */
  workflowSteps?: string;

  /** # Örnekler: Optional intra-disciplinary few-shot examples. */
  examples?: string;
}

/**
 * Builds a standardized, type-safe PromptPayload following the Markdown section enclosure rules
 * defined in docs/LLM_INTEGRATION.md Section 4.
 *
 * @param input - Structural inputs for the prompt payload.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildPromptPayload(input: PromptBuilderInput): PromptPayload {
  const systemInstructionParts: string[] = [
    `# Rol ve Uzmanlık\n\n${input.roleAndExpertise.trim()}`,
    `# Birincil Görev\n\n${input.primaryTask.trim()}`,
    `# Kurallar ve Sınırlamalar\n\n${input.rulesAndConstraints.trim()}`,
  ];

  if (input.workflowSteps?.trim()) {
    systemInstructionParts.push(
      `# İşlem Adımları\n\n${input.workflowSteps.trim()}`,
    );
  }

  systemInstructionParts.push(`# Çıktı Biçimi\n\n${input.outputFormat.trim()}`);

  if (input.examples?.trim()) {
    systemInstructionParts.push(`# Örnekler\n\n${input.examples.trim()}`);
  }

  const systemInstruction = systemInstructionParts.join("\n\n");
  const userPrompt = `# Girdi Bağlamı ve Veri\n\n${input.inputContext.trim()}`;

  return {
    systemInstruction,
    userPrompt,
  };
}
