"use client";

import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Target,
  Compass,
  Database,
  BookOpen,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { ThesisMatrix } from "@/lib/types";
import type { MatrixFieldKey } from "../_services/rubrics";

interface HudSegmentConfig {
  key: MatrixFieldKey;
  number: string;
  label: string;
  Icon: LucideIcon;
}

const SEGMENTS: HudSegmentConfig[] = [
  {
    key: "subjectProblem",
    number: "01",
    label: "Araştırma Problemi",
    Icon: Target,
  },
  {
    key: "theoreticalFramework",
    number: "02",
    label: "Teorik Çerçeve",
    Icon: Compass,
  },
  {
    key: "primaryMaterial",
    number: "03",
    label: "Veri Kaynağı",
    Icon: Database,
  },
  {
    key: "methodology",
    number: "04",
    label: "Metodoloji",
    Icon: BookOpen,
  },
];

interface MatrixTopHudProps {
  matrix: Partial<ThesisMatrix>;
  onSelectSegment: (key: MatrixFieldKey) => void;
}

/**
 * Top interactive HUD status bar for the single-column conversational matrix onboarding.
 * Displays real-time status of all 4 quadrants as clickable badges.
 */
export const MatrixTopHud = memo(function MatrixTopHud({
  matrix,
  onSelectSegment,
}: MatrixTopHudProps) {
  return (
    <div className="w-full rounded-lg bg-card border border-border p-2.5 shrink-0">
      {/* 4 Quadrants Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
        {SEGMENTS.map(({ key, number, label, Icon }) => {
          const value = matrix[key]?.trim() ?? "";
          const isCompleted = value.length >= 20;
          const isDiscussing = value.length > 0 && !isCompleted;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectSegment(key)}
              className={`flex items-center justify-between p-2 rounded-md border text-left transition-all hover:border-primary/40 cursor-pointer ${
                isCompleted
                  ? "border-primary/20 bg-background/60"
                  : isDiscussing
                    ? "border-warning/20 bg-background/60"
                    : "border-border/60 bg-background/30"
              }`}
            >
              <div className="flex items-center space-x-1.5 min-w-0 pr-1">
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                  {number}
                </span>
                <div className="size-5 rounded bg-secondary text-secondary-foreground border border-border flex items-center justify-center shrink-0">
                  <Icon className="size-2.5" />
                </div>
                <span className="text-xs font-medium text-foreground truncate">
                  {label}
                </span>
              </div>

              {isCompleted ? (
                <CheckCircle2 className="size-3 text-success shrink-0" />
              ) : isDiscussing ? (
                <Clock className="size-3 text-warning shrink-0" />
              ) : (
                <div className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
