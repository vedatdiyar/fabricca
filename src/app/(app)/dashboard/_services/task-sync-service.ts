import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { tasks, type TaskType, type Task } from "@/core/db/schema";
import { createFlowId, Logger } from "@/lib/logger";
import {
  loadAcademicTaskContext,
  type AcademicTaskContext,
} from "./task-context-loader";

import { calculateTimelineMetrics } from "@/core/services/timeline/timeline-engine";

const MAX_ACTIVE_AUTOMATED_TASKS = 3;

interface CandidateTask {
  taskType: TaskType;
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  boxId: number | null;
  sourceId: number | null;
  targetUrl: string;
  pillar: string;
}

/** Legacy emoji characters once embedded in generated task titles. */
const EMOJI_PATTERN =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu;

/**
 * Strips legacy emoji characters from a task title.
 *
 * @param title - Raw task title
 * @returns Sanitized title without emoji characters
 */
export function sanitizeTaskTitle(title: string): string {
  return title.replace(EMOJI_PATTERN, "").trim();
}

/**
 * Checks whether a READING task is satisfied (linked source is marked read).
 *
 * @param task - The task to evaluate.
 * @param context - Aggregated academic state.
 * @returns True when the task should be completed.
 */
function isReadingTaskSatisfied(task: Task, context: AcademicTaskContext): boolean {
  if (!task.sourceId) return false;
  const src = context.sources.find((s) => s.id === task.sourceId);
  return !!src && src.isRead;
}

/**
 * Checks whether a NOTE_TAKING task is satisfied (linked source has at least one annotation).
 *
 * @param task - The task to evaluate.
 * @param context - Aggregated academic state.
 * @returns True when the task should be completed.
 */
function isNoteTakingTaskSatisfied(task: Task, context: AcademicTaskContext): boolean {
  if (!task.sourceId) return false;
  return context.annotations.some((a) => a.sourceId === task.sourceId);
}

/**
 * Checks whether a CARD_SORTING task is satisfied (all citation cards for the box are linked to outline).
 *
 * @param task - The task to evaluate.
 * @param context - Aggregated academic state.
 * @returns True when the task should be completed.
 */
function isCardSortingTaskSatisfied(task: Task, context: AcademicTaskContext): boolean {
  if (!task.boxId) return false;
  const boxSourceIds = context.sources.filter((s) => s.boxId === task.boxId).map((s) => s.id);
  const boxCards = context.annotations.filter(
    (a) => boxSourceIds.includes(a.sourceId) && a.sentToCitationCards,
  );
  if (boxCards.length === 0) return false;
  return boxCards.every((c) => context.linkedAnnotationIds.has(c.id));
}

/**
 * Checks whether a BOX_GAP task is satisfied (box now contains at least one source).
 *
 * @param task - The task to evaluate.
 * @param context - Aggregated academic state.
 * @returns True when the task should be completed.
 */
function isBoxGapTaskSatisfied(task: Task, context: AcademicTaskContext): boolean {
  if (!task.boxId) return false;
  return context.sources.some((s) => s.boxId === task.boxId);
}

/**
 * Pure rule dispatcher that evaluates whether a single task meets its completion condition.
 *
 * @param task - The task to evaluate.
 * @param context - Aggregated academic state.
 * @returns True when the task should be auto-completed.
 */
function shouldTaskComplete(task: Task, context: AcademicTaskContext): boolean {
  switch (task.taskType) {
    case "READING":
      return isReadingTaskSatisfied(task, context);
    case "NOTE_TAKING":
      return isNoteTakingTaskSatisfied(task, context);
    case "CARD_SORTING":
      return isCardSortingTaskSatisfied(task, context);
    case "BOX_GAP":
      return isBoxGapTaskSatisfied(task, context);
    default:
      return false;
  }
}

/**
 * Auto-completes automated tasks whose completion conditions are now satisfied.
 *
 * @param userTasks - Existing tasks of the user (mutated in place for completed rows)
 * @param context - Aggregated academic state used to evaluate completion rules
 * @returns Number of tasks transitioned to DONE
 */
export async function autoCompleteTasks(
  userTasks: Task[],
  context: AcademicTaskContext,
): Promise<number> {
  let autoCompletedCount = 0;

  for (const t of userTasks) {
    if (!t.isAutomated || t.status === "DONE") continue;
    if (!shouldTaskComplete(t, context)) continue;

    await db.update(tasks).set({ status: "DONE", updatedAt: new Date() }).where(eq(tasks.id, t.id));
    t.status = "DONE";
    autoCompletedCount++;
  }

  return autoCompletedCount;
}

// ---------------------------------------------------------------------------
// Candidate generation — 4 independent helpers (SRP)
// ---------------------------------------------------------------------------

function formatAuthorDisplay(
  authors: string[] | null | undefined,
  publicationYear: number | null | undefined,
): { authorDisplay: string; yearDisplay: string } {
  const authorDisplay =
    authors && authors.length > 0 ? authors[0] : "Akademik Kaynak";
  const yearDisplay = publicationYear ? ` (${publicationYear})` : "";
  return { authorDisplay, yearDisplay };
}

function isPillarKey(
  boxType: string | null | undefined,
  candidatesByPillar: Record<string, CandidateTask[]>,
): boolean {
  return !!boxType && boxType in candidatesByPillar;
}

/**
 * Candidates A: unread sources (READING). Only when literature is not frozen.
 */
function generateReadingCandidates(
  context: AcademicTaskContext,
  boxMap: Map<number, (typeof context.boxes)[number]>,
  candidatesByPillar: Record<string, CandidateTask[]>,
  activeReadingSourceIds: Set<number>,
  isLiteratureFrozen: boolean,
): void {
  if (isLiteratureFrozen) return;
  for (const src of context.sources) {
    if (src.isRead || activeReadingSourceIds.has(src.id)) continue;
    const box = boxMap.get(src.boxId);
    if (!box || !isPillarKey(box.boxType, candidatesByPillar)) continue;
    const { authorDisplay, yearDisplay } = formatAuthorDisplay(src.authors, src.publicationYear);
    candidatesByPillar[box.boxType!]!.push({
      taskType: "READING",
      title: `${authorDisplay}${yearDisplay} eserini incele ve fişle`,
      description: `"${src.title}" kaynağını inceleyerek teziniz için kritik argümanları ve alıntı fişlerini çıkarın.`,
      priority: "HIGH",
      boxId: box.id,
      sourceId: src.id,
      targetUrl: `/library`,
      pillar: box.boxType!,
    });
  }
}

/**
 * Candidates B: read sources without notes (NOTE_TAKING).
 */
function generateNoteTakingCandidates(
  context: AcademicTaskContext,
  boxMap: Map<number, (typeof context.boxes)[number]>,
  candidatesByPillar: Record<string, CandidateTask[]>,
  activeReadingSourceIds: Set<number>,
): void {
  for (const src of context.sources) {
    if (!src.isRead || activeReadingSourceIds.has(src.id)) continue;
    const hasNotes = context.annotations.some((a) => a.sourceId === src.id);
    if (hasNotes) continue;
    const box = boxMap.get(src.boxId);
    if (!box || !isPillarKey(box.boxType, candidatesByPillar)) continue;
    const { authorDisplay, yearDisplay } = formatAuthorDisplay(src.authors, src.publicationYear);
    candidatesByPillar[box.boxType!]!.push({
      taskType: "NOTE_TAKING",
      title: `${authorDisplay}${yearDisplay} kaynağından alıntı fişi çıkar`,
      description: `İncelenen "${src.title}" eserinden tez planınıza kanıt oluşturacak alıntı fişleri oluşturun.`,
      priority: "HIGH",
      boxId: box.id,
      sourceId: src.id,
      targetUrl: `/library`,
      pillar: box.boxType!,
    });
  }
}

/**
 * Candidates C: unsorted citation cards (CARD_SORTING).
 */
function generateSortingCandidates(
  context: AcademicTaskContext,
  candidatesByPillar: Record<string, CandidateTask[]>,
  activeSortingBoxIds: Set<number>,
): void {
  for (const box of context.boxes) {
    if (activeSortingBoxIds.has(box.id)) continue;
    const boxSourceIds = context.sources.filter((s) => s.boxId === box.id).map((s) => s.id);
    const unsortedCards = context.annotations.filter(
      (a) => boxSourceIds.includes(a.sourceId) && a.sentToCitationCards && !context.linkedAnnotationIds.has(a.id),
    );
    if (unsortedCards.length === 0 || !isPillarKey(box.boxType, candidatesByPillar)) continue;
    candidatesByPillar[box.boxType!]!.push({
      taskType: "CARD_SORTING",
      title: `"${box.title}" kutusundaki ${unsortedCards.length} fişi tez planına bağla`,
      description: `Kutunuzda bulunan ${unsortedCards.length} adet alıntı kartını ilgili tez alt başlıklarıyla eşleştirin.`,
      priority: "HIGH",
      boxId: box.id,
      sourceId: null,
      targetUrl: `/citation-cards`,
      pillar: box.boxType!,
    });
  }
}

/**
 * Candidates D: empty boxes (BOX_GAP). Only when literature is not frozen.
 */
function generateGapCandidates(
  context: AcademicTaskContext,
  candidatesByPillar: Record<string, CandidateTask[]>,
  activeBoxGapIds: Set<number>,
  isLiteratureFrozen: boolean,
): void {
  if (isLiteratureFrozen) return;
  for (const box of context.boxes) {
    if (activeBoxGapIds.has(box.id)) continue;
    const boxSources = context.sources.filter((s) => s.boxId === box.id);
    if (boxSources.length !== 0 || !isPillarKey(box.boxType, candidatesByPillar)) continue;
    candidatesByPillar[box.boxType!]!.push({
      taskType: "BOX_GAP",
      title: `"${box.title}" teması için literatür tara`,
      description: `Bu alt kutuda henüz onaylanmış bir akademik kaynak bulunmuyor. Kütüphaneden kaynak ekleyin.`,
      priority: "MEDIUM",
      boxId: box.id,
      sourceId: null,
      targetUrl: `/library`,
      pillar: box.boxType!,
    });
  }
}

/**
 * Formulates potential candidate tasks grouped by the 4 thesis pillars,
 * skipping entities already covered by an active task.
 *
 * @param context - Aggregated academic state
 * @returns Candidate tasks keyed by pillar name
 */
export function generateCandidateTasks(
  context: AcademicTaskContext,
): Record<string, CandidateTask[]> {
  const candidatesByPillar: Record<string, CandidateTask[]> = {
    SUBJECT_PROBLEM: [],
    THEORETICAL_FRAMEWORK: [],
    PRIMARY_MATERIAL: [],
    METHODOLOGY: [],
  };

  const boxMap = new Map(context.boxes.map((b) => [b.id, b]));

  const readCount = context.sources.filter((s) => s.isRead).length;
  const timeline = calculateTimelineMetrics({
    startDate: context.matrix.createdAt,
    targetDate: context.matrix.targetCompletionDate,
    degree: context.matrix.thesisDegree,
    weeklyHours: context.matrix.weeklyTargetHours,
    currentSources: context.sources.length,
    readSources: readCount,
  });

  const activeReadingSourceIds = new Set<number>(
    context.tasks.filter((t) => t.sourceId !== null && t.status !== "DONE").map((t) => t.sourceId as number),
  );
  const activeBoxGapIds = new Set<number>(
    context.tasks.filter((t) => t.taskType === "BOX_GAP" && t.boxId !== null && t.status !== "DONE").map((t) => t.boxId as number),
  );
  const activeSortingBoxIds = new Set<number>(
    context.tasks.filter((t) => t.taskType === "CARD_SORTING" && t.boxId !== null && t.status !== "DONE").map((t) => t.boxId as number),
  );

  generateReadingCandidates(context, boxMap, candidatesByPillar, activeReadingSourceIds, timeline.isLiteratureFrozen);
  generateNoteTakingCandidates(context, boxMap, candidatesByPillar, activeReadingSourceIds);
  generateSortingCandidates(context, candidatesByPillar, activeSortingBoxIds);
  generateGapCandidates(context, candidatesByPillar, activeBoxGapIds, timeline.isLiteratureFrozen);

  return candidatesByPillar;
}

/**
 * Round-Robin selection across the 4 thesis pillars to maintain balance.
 *
 * @param candidatesByPillar - Candidate tasks grouped by pillar (consumed via shift)
 * @param slots - Maximum number of candidates to select
 * @returns The selected balanced candidates
 */
export function selectBalancedCandidates(
  candidatesByPillar: Record<string, CandidateTask[]>,
  slots: number,
): CandidateTask[] {
  const pillars = [
    "SUBJECT_PROBLEM",
    "THEORETICAL_FRAMEWORK",
    "PRIMARY_MATERIAL",
    "METHODOLOGY",
  ];

  const selectedToInsert: CandidateTask[] = [];
  let added = 0;
  let round = 0;
  const maxRounds = 5;

  while (added < slots && round < maxRounds) {
    let anyPickedInThisRound = false;
    for (const pillar of pillars) {
      const pillarCandidates = candidatesByPillar[pillar];
      if (pillarCandidates && pillarCandidates.length > 0) {
        const candidate = pillarCandidates.shift();
        if (candidate) {
          selectedToInsert.push(candidate);
          added++;
          anyPickedInThisRound = true;
          if (added >= slots) break;
        }
      }
    }
    if (!anyPickedInThisRound) break;
    round++;
  }

  return selectedToInsert;
}

/**
 * Synchronizes automated academic tasks for a user.
 * 1. Purges legacy emoji characters from existing task titles.
 * 2. Auto-completes existing automated tasks whose conditions are now satisfied.
 * 3. Balances new tasks across the 4 thesis pillars so research does not skew into a single area.
 * 4. Limits active automated tasks to a healthy ADHD threshold (MAX_ACTIVE_AUTOMATED_TASKS) to prevent overwhelm.
 *
 * @param userId - ID of the authenticated user
 * @returns Summary of synchronized tasks
 */
export async function syncAcademicTasks(userId: number): Promise<{
  autoCompletedCount: number;
  newTasksCreatedCount: number;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    // 1. Load aggregated academic snapshot
    const context = await loadAcademicTaskContext(userId);
    if (!context) {
      return { autoCompletedCount: 0, newTasksCreatedCount: 0 };
    }

    // 2. Clean legacy emojis from existing task titles
    for (const t of context.tasks) {
      const sanitizedTitle = sanitizeTaskTitle(t.title);
      if (sanitizedTitle !== t.title && sanitizedTitle.length > 0) {
        await db
          .update(tasks)
          .set({ title: sanitizedTitle, updatedAt: new Date() })
          .where(eq(tasks.id, t.id));
        t.title = sanitizedTitle;
      }
    }

    // 3. Auto-complete satisfied tasks
    const autoCompletedCount = await autoCompleteTasks(context.tasks, context);

    // 4. Determine remaining capacity for new automated tasks
    const activeAutomatedTasks = context.tasks.filter(
      (t) =>
        t.isAutomated && (t.status === "TODO" || t.status === "IN_PROGRESS"),
    );
    const neededSlots =
      MAX_ACTIVE_AUTOMATED_TASKS - activeAutomatedTasks.length;
    if (neededSlots <= 0) {
      log.info("academic_tasks_synced", {
        service: "dashboard",
        data: { userId, autoCompletedCount, newTasksCreatedCount: 0 },
      });
      return { autoCompletedCount, newTasksCreatedCount: 0 };
    }

    // 5. Generate pillar-balanced candidates and insert the selection
    const candidatesByPillar = generateCandidateTasks(context);
    const selectedToInsert = selectBalancedCandidates(
      candidatesByPillar,
      neededSlots,
    );

    let newTasksCreatedCount = 0;
    for (const item of selectedToInsert) {
      await db.insert(tasks).values({
        userId,
        boxId: item.boxId,
        sourceId: item.sourceId,
        taskType: item.taskType,
        title: item.title,
        description: item.description,
        targetUrl: item.targetUrl,
        isAutomated: true,
        status: "TODO",
        priority: item.priority,
        metadata: { pillar: item.pillar },
      });
      newTasksCreatedCount++;
    }

    log.info("academic_tasks_synced", {
      service: "dashboard",
      data: {
        userId,
        autoCompletedCount,
        newTasksCreatedCount,
      },
    });

    return { autoCompletedCount, newTasksCreatedCount };
  } catch (err) {
    log.error("sync_academic_tasks_failed", {
      service: "dashboard",
      data: { userId },
      error: err,
    });
    return { autoCompletedCount: 0, newTasksCreatedCount: 0 };
  }
}
