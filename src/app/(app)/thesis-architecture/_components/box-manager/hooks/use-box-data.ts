"use client";

import { useMemo } from "react";
import type { Box } from "@/core/db/schema";
import { compareBoxTypes } from "@/lib/box-constants";
import type { BoxWithRelations } from "../constants/quadrant-config";

/** Aggregated metric counts for a single research quadrant. */
export interface PillarMetrics {
  subBoxCount: number;
  conceptCount: number;
  sourceCount: number;
  taskCount: number;
}

export interface TotalBoxMetrics {
  totalRootBoxes: number;
  totalSubBoxes: number;
  totalConcepts: number;
  totalSources: number;
  totalTasks: number;
}

export interface BoxData {
  rootBoxes: BoxWithRelations[];
  subBoxesByParent: Record<number, BoxWithRelations[]>;
  pillarMetricsById: Record<number, PillarMetrics>;
  totalMetrics: TotalBoxMetrics;
}

/**
 * Derives the canonical root box ordering, the parent → sub-box grouping and
 * the aggregate quadrant metrics (sub-box, concept, source, task counts) from the
 * flat boxes list.
 */
export function useBoxData(boxesList: BoxWithRelations[] | Box[]): BoxData {
  const rootBoxes = useMemo(() => {
    return boxesList
      .filter((b) => !b.parentId && b.boxType !== "RELATED_THESES")
      .sort((a, b) => compareBoxTypes(a.boxType, b.boxType));
  }, [boxesList]);

  const subBoxesByParent = useMemo(() => {
    const map: Record<number, BoxWithRelations[]> = {};
    for (const b of boxesList) {
      if (b.parentId && b.boxType !== "RELATED_THESES") {
        if (!map[b.parentId]) map[b.parentId] = [];
        map[b.parentId].push(b as BoxWithRelations);
      }
    }
    return map;
  }, [boxesList]);

  const pillarMetricsById = useMemo(() => {
    const map: Record<number, PillarMetrics> = {};
    for (const root of rootBoxes) {
      const subs = subBoxesByParent[root.id] ?? [];
      map[root.id] = {
        subBoxCount: subs.length,
        conceptCount: subs.reduce((acc, sub) => {
          const list = Array.isArray(sub.concepts) ? sub.concepts : [];
          return acc + list.length;
        }, 0),
        sourceCount: subs.reduce((acc, sub) => {
          return acc + (sub.sources?.length ?? 0);
        }, 0),
        taskCount: subs.reduce((acc, sub) => {
          return acc + (sub.tasks?.length ?? 0);
        }, 0),
      };
    }
    return map;
  }, [rootBoxes, subBoxesByParent]);

  const totalMetrics = useMemo<TotalBoxMetrics>(() => {
    let totalSubBoxes = 0;
    let totalConcepts = 0;
    let totalSources = 0;
    let totalTasks = 0;

    for (const root of rootBoxes) {
      const m = pillarMetricsById[root.id];
      if (m) {
        totalSubBoxes += m.subBoxCount;
        totalConcepts += m.conceptCount;
        totalSources += m.sourceCount;
        totalTasks += m.taskCount;
      }
    }

    return {
      totalRootBoxes: rootBoxes.length,
      totalSubBoxes,
      totalConcepts,
      totalSources,
      totalTasks,
    };
  }, [rootBoxes, pillarMetricsById]);

  return { rootBoxes, subBoxesByParent, pillarMetricsById, totalMetrics };
}
