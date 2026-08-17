import { Activity, Clock, CheckCircle2 } from "lucide-react";

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
    label: "Bitti",
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
