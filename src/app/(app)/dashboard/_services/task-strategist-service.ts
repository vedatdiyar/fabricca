import { z } from "zod";
import { db } from "@/core/db";
import { tasks } from "@/core/db/schema";
import { generateStructuredContent } from "@/core/services/ai/providers/gemini-provider";
import { FLASH_LITE_35 } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import type { JsonSchema } from "@/core/services/ai/llm-types";
import {
  loadAcademicTaskContext,
  type AcademicTaskContext,
} from "./task-context-loader";

const strategistResponseSchema = z.object({
  analysisSummary: z.string().min(1),
  primaryBottleneck: z.string().min(1),
  recommendedFocusPillar: z.enum([
    "SUBJECT_PROBLEM",
    "THEORETICAL_FRAMEWORK",
    "PRIMARY_MATERIAL",
    "METHODOLOGY",
  ]),
  actionSteps: z.array(
    z.object({
      taskType: z.enum([
        "READING",
        "NOTE_TAKING",
        "CARD_SORTING",
        "BOX_GAP",
        "ADVISOR_REQUEST",
        "MANUAL",
      ]),
      title: z.string().min(1),
      rationale: z.string().min(1),
      priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
      suggestedBoxId: z.number().nullable(),
      suggestedSourceId: z.number().nullable(),
    }),
  ),
});

export type StrategistAuditResult = z.infer<typeof strategistResponseSchema>;

export type StrategistActionStep = StrategistAuditResult["actionSteps"][number];

const strategistJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    analysisSummary: {
      type: "string",
      description:
        "1-2 sentence academic summary of the thesis progress and current balance in Turkish.",
    },
    primaryBottleneck: {
      type: "string",
      description:
        "The most critical academic gap or bottleneck holding the thesis back right now in Turkish.",
    },
    recommendedFocusPillar: {
      type: "string",
      enum: [
        "SUBJECT_PROBLEM",
        "THEORETICAL_FRAMEWORK",
        "PRIMARY_MATERIAL",
        "METHODOLOGY",
      ],
      description:
        "The pillar that needs the most immediate attention to restore balance.",
    },
    actionSteps: {
      type: "array",
      description:
        "Top 3 to 4 actionable, bite-sized academic micro-steps for the researcher.",
      items: {
        type: "object",
        properties: {
          taskType: {
            type: "string",
            enum: [
              "READING",
              "NOTE_TAKING",
              "CARD_SORTING",
              "BOX_GAP",
              "ADVISOR_REQUEST",
              "MANUAL",
            ],
          },
          title: {
            type: "string",
            description: "Action-oriented task title in Turkish.",
          },
          rationale: {
            type: "string",
            description:
              "Brief explanation of why this step matters for thesis integrity in Turkish.",
          },
          priority: {
            type: "string",
            enum: ["HIGH", "MEDIUM", "LOW"],
          },
          suggestedBoxId: {
            type: ["number", "null"],
            description: "Matching box ID from the provided thesis boxes.",
          },
          suggestedSourceId: {
            type: ["number", "null"],
            description: "Matching source ID if this is a reading/note task.",
          },
        },
        required: ["taskType", "title", "rationale", "priority"],
      },
    },
  },
  required: [
    "analysisSummary",
    "primaryBottleneck",
    "recommendedFocusPillar",
    "actionSteps",
  ],
};

interface PillarStat {
  boxCount: number;
  sourceCount: number;
  readCount: number;
  annotationCount: number;
  unsortedCardsCount: number;
}

/**
 * Compiles per-pillar statistical summary (box/source/read/annotation counts)
 * from the aggregated academic context.
 *
 * @param context - Aggregated academic state
 * @returns Statistics keyed by pillar name
 */
export function compileStrategistStats(
  context: AcademicTaskContext,
): Record<string, PillarStat> {
  const pillarStats: Record<string, PillarStat> = {
    SUBJECT_PROBLEM: emptyStat(),
    THEORETICAL_FRAMEWORK: emptyStat(),
    PRIMARY_MATERIAL: emptyStat(),
    METHODOLOGY: emptyStat(),
  };

  for (const box of context.boxes) {
    if (!box.boxType) continue;
    const stat = pillarStats[box.boxType];
    if (!stat) continue;
    stat.boxCount++;
    const bSources = context.sources.filter((s) => s.boxId === box.id);
    stat.sourceCount += bSources.length;
    stat.readCount += bSources.filter((s) => s.isRead).length;

    const bSourceIds = bSources.map((s) => s.id);
    const bAnnots = context.annotations.filter((a) =>
      bSourceIds.includes(a.sourceId),
    );
    stat.annotationCount += bAnnots.length;
    stat.unsortedCardsCount += bAnnots.filter(
      (a) => a.sentToCitationCards && !context.linkedAnnotationIds.has(a.id),
    ).length;
  }

  return pillarStats;
}

function emptyStat(): PillarStat {
  return {
    boxCount: 0,
    sourceCount: 0,
    readCount: 0,
    annotationCount: 0,
    unsortedCardsCount: 0,
  };
}

/**
 * Builds the system instruction and user prompt for the strategist LLM audit.
 *
 * @param context - Aggregated academic state
 * @returns System instruction and prompt text
 */
export function buildStrategistPrompt(context: AcademicTaskContext): {
  systemInstruction: string;
  prompt: string;
} {
  const pillarStats = compileStrategistStats(context);

  const systemInstruction = `You are the Lead Academic Thesis Strategist and Research Architect.
Your role is to critically analyze the researcher's thesis progress across the 4 pillars (Subject/Problem, Theoretical Framework, Primary Material, Methodology).
The researcher has ADHD, which means you MUST NOT generate an overwhelming list of tasks. Instead, identify the single most critical bottleneck and formulate exactly 3 to 4 bite-sized, balanced, concrete academic micro-steps.
Ensure tasks are distributed across neglected pillars rather than piling up in one single area.
All user-facing titles, summaries, and rationales must be in fluent, authoritative, academic Turkish.
CRITICAL FORMATTING RULE: Do NOT include emoji symbols or characters (like 🎯, 📄, ✍️, 📚, 🎓) anywhere in the title or rationale. The frontend UI renders modern SVG icons automatically.`;

  const prompt = `Here is the current state of the thesis:
Matrix:
- Subject Problem: ${context.matrix.subjectProblem}
- Theoretical Framework: ${context.matrix.theoreticalFramework}
- Methodology: ${context.matrix.methodology}
- Primary Material: ${context.matrix.primaryMaterial || "Belirtilmedi"}

Pillar Statistics:
${JSON.stringify(pillarStats, null, 2)}

Topic Boxes:
${JSON.stringify(
  context.boxes.map((b) => ({
    id: b.id,
    title: b.title,
    type: b.boxType,
    sourcesCount: context.sources.filter((s) => s.boxId === b.id).length,
  })),
  null,
  2,
)}

Unread Sources Available (Sample):
${JSON.stringify(
  context.sources
    .filter((s) => !s.isRead)
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      boxId: s.boxId,
      title: s.title,
      authors: s.authors,
      year: s.publicationYear,
    })),
  null,
  2,
)}

Active Tasks in Board:
${JSON.stringify(
  context.tasks
    .filter((t) => t.status !== "DONE")
    .map((t) => ({ id: t.id, title: t.title, type: t.taskType })),
  null,
  2,
)}

Analyze the bottlenecks and output the optimal next 3-4 balanced micro-steps.`;

  return { systemInstruction, prompt };
}

/**
 * Persists strategist-recommended action steps as automated Kanban tasks,
 * skipping exact duplicate titles.
 *
 * @param userId - ID of the authenticated user
 * @param steps - Recommended action steps from the audit
 * @param existingTasks - Current tasks used for duplicate detection
 * @returns Number of tasks created
 */
export async function applyStrategistSteps(
  userId: number,
  steps: StrategistActionStep[],
  existingTasks: AcademicTaskContext["tasks"],
): Promise<number> {
  let createdCount = 0;

  for (const step of steps) {
    const exists = existingTasks.some(
      (t) => t.title.toLowerCase() === step.title.toLowerCase(),
    );
    if (!exists) {
      let targetUrl = "/dashboard";
      if (step.taskType === "READING" || step.taskType === "NOTE_TAKING") {
        targetUrl = "/library";
      } else if (step.taskType === "CARD_SORTING") {
        targetUrl = "/citation-cards";
      } else if (step.taskType === "BOX_GAP") {
        targetUrl = "/library";
      }

      await db.insert(tasks).values({
        userId,
        boxId: step.suggestedBoxId ?? null,
        sourceId: step.suggestedSourceId ?? null,
        taskType: step.taskType,
        title: step.title,
        description: step.rationale,
        targetUrl,
        isAutomated: true,
        status: "TODO",
        priority: step.priority,
      });
      createdCount++;
    }
  }

  return createdCount;
}

const STRATEGIST_PROVIDER_OPTIONS = {
  zodSchema: strategistResponseSchema,
  operation: "thesis-strategist-audit",
  payloadStage: "task-strategist",
  thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
} as const;

/**
 * Runs a deep LLM audit of the user's thesis state and generates a balanced, ADHD-friendly task strategy.
 *
 * @param userId - ID of the authenticated user
 * @returns Structured strategist audit result
 */
export async function runThesisStrategistAudit(
  userId: number,
): Promise<{ success: boolean; data?: StrategistAuditResult; error?: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    // 1. Load aggregated academic snapshot
    const context = await loadAcademicTaskContext(userId);
    if (!context) {
      return {
        success: false,
        error: "Analiz yapılacak tez mimarisi bulunamadı.",
      };
    }

    // 2. Build the audit prompt from compiled statistics
    const { systemInstruction, prompt } = buildStrategistPrompt(context);

    // 3. Invoke the Gemini structured audit
    const result = await generateStructuredContent<StrategistAuditResult>(
      FLASH_LITE_35,
      systemInstruction,
      prompt,
      strategistJsonSchema,
      log,
      STRATEGIST_PROVIDER_OPTIONS,
    );

    // 4. Apply the recommended steps into the database
    await applyStrategistSteps(userId, result.actionSteps, context.tasks);

    return { success: true, data: result };
  } catch (err) {
    log.error("run_thesis_strategist_audit_failed", {
      service: "dashboard",
      data: { userId },
      error: err,
    });
    return {
      success: false,
      error: "Tez stratejisi analizi sırasında bir hata oluştu.",
    };
  }
}
