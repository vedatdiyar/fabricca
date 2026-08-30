/**
 * Timeline Engine for Fabricca.
 *
 * Implements academic calendar phase calculations based on user's target completion date
 * and degree type (MASTER vs DOCTORATE).
 *
 * Phase distribution according to academic literature standards:
 * - Phase 1: Literatür Tarama & Hızlı Okuma (%25) -> Literature searching & active expansion allowed.
 * - Phase 2: Fişleme & Kavram Haritası (%20) -> Literature frozen. Citation cards extracted & linked to outline.
 * - Phase 3: Bölüm Taslakları Yazımı (%40) -> Main drafting phase. Converting notes into chapter paragraphs.
 * - Phase 4: Danışman Revizyonu & Savunma (%15) -> Office Review / Draft Audit, plagiarism, jury simulation.
 */

export type ThesisDegree = "MASTER" | "DOCTORATE";

export interface PhaseInfo {
  phaseNumber: 1 | 2 | 3 | 4;
  title: string;
  shortTitle: string;
  percentage: number;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  isCompleted: boolean;
  isLiteratureFrozen: boolean;
}

export interface TimelineMetrics {
  targetCompletionDate: Date | null;
  thesisDegree: ThesisDegree;
  weeklyTargetHours: number;
  totalDays: number;
  daysPassed: number;
  daysRemaining: number;
  progressPercentage: number;
  currentPhase: PhaseInfo | null;
  phases: PhaseInfo[];
  isLiteratureFrozen: boolean;
  maxSourceLimit: number;
  currentSourceCount: number;
  readSourceCount: number;
  isSourceLimitReached: boolean;
  recommendedWeeklyPaceDescription: string;
}

export const MAX_SOURCES_BY_DEGREE: Record<ThesisDegree, number> = {
  MASTER: 80,
  DOCTORATE: 180,
};

const PHASE_CONFIGS = [
  {
    phaseNumber: 1 as const,
    title: "Literatür Tarama & Hızlı Okuma",
    shortTitle: "Tarama & Okuma",
    percentage: 25,
    isLiteratureFrozen: false,
  },
  {
    phaseNumber: 2 as const,
    title: "Fişleme & Kavram Haritası",
    shortTitle: "Fişleme & Taslak",
    percentage: 20,
    isLiteratureFrozen: true,
  },
  {
    phaseNumber: 3 as const,
    title: "Bölüm Taslakları Yazımı",
    shortTitle: "Bölüm Yazımı",
    percentage: 40,
    isLiteratureFrozen: true,
  },
  {
    phaseNumber: 4 as const,
    title: "Danışman Revizyonu & Savunma",
    shortTitle: "Revizyon & Savunma",
    percentage: 15,
    isLiteratureFrozen: true,
  },
];

/**
 * Calculates dynamic academic calendar metrics from project start/now until target completion date.
 *
 * @param startDate - Date when project/matrix was created.
 * @param targetDate - User's chosen completion date.
 * @param degree - Master or Doctorate degree.
 * @param weeklyHours - Planned weekly working hours.
 * @param currentSources - Total current approved sources.
 * @param readSources - Total read sources.
 * @param now - Optional reference date (defaults to new Date()).
 * @returns Comprehensive timeline metrics and phase statuses.
 */
export function calculateTimelineMetrics({
  startDate,
  targetDate,
  degree = "MASTER",
  weeklyHours = 15,
  currentSources = 0,
  readSources = 0,
  now = new Date(),
}: {
  startDate: Date;
  targetDate: Date | null;
  degree?: ThesisDegree;
  weeklyHours?: number;
  currentSources?: number;
  readSources?: number;
  now?: Date;
}): TimelineMetrics {
  const maxSourceLimit = MAX_SOURCES_BY_DEGREE[degree] ?? 80;
  const isSourceLimitReached = currentSources >= maxSourceLimit;

  if (!targetDate || isNaN(targetDate.getTime())) {
    return {
      targetCompletionDate: null,
      thesisDegree: degree,
      weeklyTargetHours: weeklyHours,
      totalDays: 0,
      daysPassed: 0,
      daysRemaining: 0,
      progressPercentage: 0,
      currentPhase: null,
      phases: [],
      isLiteratureFrozen: isSourceLimitReached,
      maxSourceLimit,
      currentSourceCount: currentSources,
      readSourceCount: readSources,
      isSourceLimitReached,
      recommendedWeeklyPaceDescription: "Teslim tarihi belirlenmedi.",
    };
  }

  const startMs = startDate.getTime();
  const targetMs = targetDate.getTime();
  const nowMs = now.getTime();

  // Total span from start to target in days (minimum 1 day)
  const totalDays = Math.max(
    1,
    Math.round((targetMs - startMs) / (1000 * 60 * 60 * 24)),
  );
  const daysPassed = Math.max(
    0,
    Math.round((nowMs - startMs) / (1000 * 60 * 60 * 24)),
  );
  const daysRemaining = Math.max(
    0,
    Math.round((targetMs - nowMs) / (1000 * 60 * 60 * 24)),
  );

  const progressPercentage = Math.min(
    100,
    Math.max(0, Math.round((daysPassed / totalDays) * 100)),
  );

  // Compute exact dates for each phase
  let accumulatedDays = 0;
  const phases: PhaseInfo[] = PHASE_CONFIGS.map((cfg, index) => {
    const phaseDays = Math.round((totalDays * cfg.percentage) / 100);
    const phaseStartMs = startMs + accumulatedDays * 24 * 60 * 60 * 1000;
    const isLast = index === PHASE_CONFIGS.length - 1;
    const phaseEndMs = isLast
      ? targetMs
      : phaseStartMs + phaseDays * 24 * 60 * 60 * 1000;

    accumulatedDays += phaseDays;

    const isCurrent = nowMs >= phaseStartMs && (nowMs < phaseEndMs || isLast);
    const isCompleted = nowMs >= phaseEndMs && !isLast;

    return {
      phaseNumber: cfg.phaseNumber,
      title: cfg.title,
      shortTitle: cfg.shortTitle,
      percentage: cfg.percentage,
      startDate: new Date(phaseStartMs),
      endDate: new Date(phaseEndMs),
      isCurrent,
      isCompleted,
      isLiteratureFrozen: cfg.isLiteratureFrozen,
    };
  });

  // If now is past target, mark last phase as current
  let currentPhase = phases.find((p) => p.isCurrent) || null;
  if (!currentPhase && phases.length > 0) {
    if (nowMs >= targetMs) {
      currentPhase = phases[phases.length - 1] ?? null;
    } else {
      currentPhase = phases[0] ?? null;
    }
  }

  const isLiteratureFrozen =
    isSourceLimitReached ||
    (currentPhase ? currentPhase.phaseNumber >= 2 : false);

  // Formulate natural Turkish pacing recommendation
  let paceDesc = "";
  if (daysRemaining <= 0) {
    paceDesc =
      "Teslim tarihi tamamlandı. Savunma hazırlıkları aşamasındasınız.";
  } else if (currentPhase?.phaseNumber === 1) {
    const unread = Math.max(0, currentSources - readSources);
    const weeksRemainingInPhase = Math.max(
      1,
      Math.round(
        (currentPhase.endDate.getTime() - nowMs) / (1000 * 60 * 60 * 24 * 7),
      ),
    );
    const weeklyReadingTarget = Math.ceil(unread / weeksRemainingInPhase);
    paceDesc = `1. Fazdasınız: Haftalık ${weeklyReadingTarget > 0 ? weeklyReadingTarget : 2} kaynak inceleme ve ön eleme temposu önerilmektedir.`;
  } else if (currentPhase?.phaseNumber === 2) {
    paceDesc =
      "2. Fazdasınız: Literatür donduruldu. Mevcut alıntı fişlerini tez iskeletine bağlayın.";
  } else if (currentPhase?.phaseNumber === 3) {
    paceDesc =
      "3. Fazdasınız: Yoğun yazım aşaması. Her hafta 1-2 alt başlığı taslağa dökün.";
  } else {
    paceDesc =
      "4. Fazdasınız: Danışman Odası denetimleri ve jüri eleştirileriyle revizyon yapın.";
  }

  return {
    targetCompletionDate: targetDate,
    thesisDegree: degree,
    weeklyTargetHours: weeklyHours,
    totalDays,
    daysPassed,
    daysRemaining,
    progressPercentage,
    currentPhase,
    phases,
    isLiteratureFrozen,
    maxSourceLimit,
    currentSourceCount: currentSources,
    readSourceCount: readSources,
    isSourceLimitReached,
    recommendedWeeklyPaceDescription: paceDesc,
  };
}
