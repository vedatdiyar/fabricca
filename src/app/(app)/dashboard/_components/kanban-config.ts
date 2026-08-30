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
    iconColor: "text-info",
    badgeColor: "bg-info/10 text-info border-info/20",
  },
  {
    id: "IN_PROGRESS",
    label: "Yapılıyor",
    icon: Activity,
    iconColor: "text-warning",
    badgeColor: "bg-warning/10 text-warning border-warning/20",
  },
  {
    id: "DONE",
    label: "Tamamlandı",
    icon: CheckCircle2,
    iconColor: "text-success",
    badgeColor: "bg-success/10 text-success border-success/20",
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
    badgeClass: "bg-info/10 text-info border-info/20",
    ctaText: "Okumaya Başla →",
  },
  NOTE_TAKING: {
    label: "Not & Alıntı",
    icon: PenTool,
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    ctaText: "Not Çıkar →",
  },
  CARD_SORTING: {
    label: "Fiş Tasnifi",
    icon: Layers,
    badgeClass: "bg-success/10 text-success border-success/20",
    ctaText: "Taslağa Eşle →",
  },
  OUTLINE_WRITING: {
    label: "Bölüm Yazımı",
    icon: PenTool,
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    ctaText: "Taslağı Yaz →",
  },
  BOX_GAP: {
    label: "Literatür Tarama",
    icon: Target,
    badgeClass: "bg-info/10 text-info border-info/20",
    ctaText: "Kütüphaneyi Aç →",
  },
  ADVISOR_REQUEST: {
    label: "Danışman Talebi",
    icon: GraduationCap,
    badgeClass: "bg-primary/10 text-primary border-primary/20",
  },
  MANUAL: {
    label: "Kişisel Hedef",
    icon: Sparkles,
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};
