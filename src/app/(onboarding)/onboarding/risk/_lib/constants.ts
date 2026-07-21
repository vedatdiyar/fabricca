import type { AcademicBadge, RelationshipBadge } from "@/lib/types";

export const RELATIONSHIP_BADGE_LABELS: Record<RelationshipBadge, string> = {
  HIGH_RISK: "Yüksek Risk / Doğrudan Çakışma",
  CONTRIBUTION_READY: "Katkı ve Yararlanmaya Hazır",
  UNRELATED: "Alakasız / Havuz Sızıntısı",
};

export const RELATIONSHIP_BADGE_COLORS: Record<RelationshipBadge, string> = {
  HIGH_RISK: "bg-destructive/10 border-destructive/20 text-destructive",
  CONTRIBUTION_READY: "bg-info/10 border-info/20 text-info",
  UNRELATED: "bg-muted/10 border-border/40 text-muted-foreground",
};

export function getGlobalBadgeConfig(badge: string): {
  text: string;
  bgClass: string;
} {
  const key = badge as RelationshipBadge;
  const text = RELATIONSHIP_BADGE_LABELS[key];
  const bgClass = RELATIONSHIP_BADGE_COLORS[key];
  if (text && bgClass) return { text, bgClass };
  return {
    text: badge,
    bgClass: "bg-muted/10 border-border/40 text-muted-foreground",
  };
}

type BadgeType = "danger" | "warning" | "success" | "info";

interface AcademicBadgeMeta {
  title: string;
  description: string;
  type: BadgeType;
}

export const ACADEMIC_BADGE_META: Record<AcademicBadge, AcademicBadgeMeta> = {
  HIGH_RISK_REPLICATION: {
    title: "İkiz Tez",
    description:
      "Tezinizle birebir örtüşen araştırma parametrelerine sahiptir. Özgünlük beyanınızda mutlaka ele almanız gereken bir çalışmadır.",
    type: "danger",
  },
  RELATED_THESIS: {
    title: "İlişkili Çalışma",
    description:
      "Ortak noktalar barındırmakla birlikte farklılaştığı alanlar sayesinde tezinize katkı sağlayabilir.",
    type: "warning",
  },
  SAFE_ORIGINAL: {
    title: "Faydalı",
    description:
      "Tezinizle herhangi bir çakışması bulunmamaktadır. Literatür taramanızda rahatlıkla kullanabileceğiniz bir kaynaktır.",
    type: "success",
  },
};

const ACADEMIC_BADGE_STYLE: Record<
  AcademicBadge,
  { card: string; border: string; text: string }
> = {
  HIGH_RISK_REPLICATION: {
    card: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
  },
  RELATED_THESIS: {
    card: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
  },
  SAFE_ORIGINAL: {
    card: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
  },
};

export function getAcademicBadgeConfig(badge: string): {
  label: string;
  description: string;
  card: string;
  border: string;
  text: string;
} {
  const key = badge as AcademicBadge;
  const meta = ACADEMIC_BADGE_META[key];
  const style = ACADEMIC_BADGE_STYLE[key];
  if (meta && style) {
    return { label: meta.title, description: meta.description, ...style };
  }
  return {
    label: badge,
    description: "",
    card: "bg-muted/5",
    border: "border-border/40",
    text: "text-muted-foreground",
  };
}

export function getUiBadgeConfig(badge: string): {
  text: string;
  bgClass: string;
} {
  const key = badge as AcademicBadge;
  const meta = ACADEMIC_BADGE_META[key];
  const style = ACADEMIC_BADGE_STYLE[key];
  if (meta && style) {
    return {
      text: meta.title,
      bgClass: `${style.card} border ${style.border} ${style.text}`,
    };
  }

  const globalKey = badge as RelationshipBadge;
  if (globalKey in RELATIONSHIP_BADGE_LABELS) {
    const text = RELATIONSHIP_BADGE_LABELS[globalKey];
    const bgClass = RELATIONSHIP_BADGE_COLORS[globalKey];
    return { text, bgClass };
  }

  return {
    text: badge,
    bgClass: "bg-muted/10 border-border/40 text-muted-foreground",
  };
}
