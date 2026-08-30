import {
  Activity,
  Clock,
  CheckCircle2,
  BookOpen,
  PenTool,
  Layers,
  Target,
  GraduationCap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { TaskType } from "@/core/db/schema";

export const COLUMNS = [
  {
    id: "TODO",
    label: "Yapılacaklar",
    icon: Clock,
    iconColor: "text-blue-500",
    badgeColor:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: "IN_PROGRESS",
    label: "Yapılıyor",
    icon: Activity,
    iconColor: "text-amber-500",
    badgeColor:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  {
    id: "DONE",
    label: "Tamamlandı",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    badgeColor:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
] as const;

export type KanbanColumnId = (typeof COLUMNS)[number]["id"];

export const PRIORITY_CONFIG: Record<
  "HIGH" | "MEDIUM" | "LOW",
  { label: string; className: string }
> = {
  HIGH: {
    label: "Yüksek",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  MEDIUM: {
    label: "Orta",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  LOW: {
    label: "Düşük",
    className: "bg-info/10 text-info border-info/20",
  },
};

export interface TaskTypeDefinition {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
  ctaText?: string;
}

export const TASK_TYPE_CONFIG: Record<TaskType, TaskTypeDefinition> = {
  READING: {
    label: "Kaynak Okuma",
    icon: BookOpen,
    badgeClass:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    ctaText: "Okumaya Başla →",
  },
  NOTE_TAKING: {
    label: "Not & Alıntı",
    icon: PenTool,
    badgeClass:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    ctaText: "Not Çıkar →",
  },
  CARD_SORTING: {
    label: "Fiş Tasnifi",
    icon: Layers,
    badgeClass:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    ctaText: "Taslağa Eşle →",
  },
  OUTLINE_WRITING: {
    label: "Bölüm Yazımı",
    icon: PenTool,
    badgeClass:
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    ctaText: "Taslağı Yaz →",
  },
  BOX_GAP: {
    label: "Literatür Tarama",
    icon: Target,
    badgeClass:
      "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    ctaText: "Kütüphaneyi Aç →",
  },
  ADVISOR_REQUEST: {
    label: "Danışman Talebi",
    icon: GraduationCap,
    badgeClass:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  MANUAL: {
    label: "Kişisel Hedef",
    icon: Sparkles,
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};
