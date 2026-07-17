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
  IRRELEVANT_DATA: {
    title: "Analiz Dışı Veri",
    description:
      "Ana iddiası ve araştırma odağı tezinizle örtüşmediği için analiz dışı bırakılmıştır.",
    type: "danger",
  },
  TWIN_THESIS_ALERT: {
    title: "Birebir Çakışma",
    description:
      "Tüm bilimsel araştırma parametreleri teziniz ile tam uyumluluk göstermektedir. Özgünlük riski çok yüksektir.",
    type: "danger",
  },
  CRITICAL_REPLICATION_ALERT: {
    title: "Kritik Metodolojik Tekrar",
    description:
      "Temel bağlamsal unsurlar ve yöntem tasarımı referans çalışma ile çok yüksek oranda çakışmaktadır.",
    type: "warning",
  },
  METHODOLOGY_REFERENCE: {
    title: "Metot Referansı",
    description:
      "Aday tezin yöntem tasarımı ve veri toplama araçları tezinizle birebir aynıdır; metot şablonunu doğrudan referans alabilirsiniz.",
    type: "success",
  },
  THEORETICAL_ANCHOR: {
    title: "Kuramsal Temel",
    description:
      "Aday tezin kavramsal çerçevesi ve kuramsal temelleri tezinizle örtüşmektedir; literatür taramanızı kurgularken referans alabilirsiniz.",
    type: "success",
  },
  HISTORICAL_CONTEXT: {
    title: "Tarihsel Arka Plan",
    description:
      "Çalışılan aktör veya odağın geçmiş bir dönemini incelemektedir. Tezinizin giriş ve tarihsel arka plan bölümlerinde olgunlaşma sürecini açıklamak için kullanılmalıdır.",
    type: "info",
  },
  FUTURE_PROJECTION: {
    title: "Gelecek Projeksiyonu",
    description:
      "Çalıştığınız konunun daha yakın/güncel bir dönemini incelemektedir. Kendi bulgularınızın gelecekteki yansımalarını veya trend takibini tartışırken kullanılmalıdır.",
    type: "info",
  },
  CONTEXTUAL_COMPARISON: {
    title: "Bağlam Transferi",
    description:
      "Benzer bir problemi farklı bir coğrafi veya kurumsal bağlamda ele almaktadır. Yöntemin/modelin yeni bir alana transfer edilmesinin getirdiği katkıyı savunmak için kullanılmalıdır.",
    type: "success",
  },
  EMPIRICAL_BENCHMARK: {
    title: "Tartışma Ortağı",
    description:
      "Benzer odak veya aktörlerle çalışmaktadır. Elde ettiğiniz bulguları bu tezin sonuçlarıyla tezinizin tartışma bölümünde kıyaslamak için kullanılmalıdır.",
    type: "success",
  },
  BACKGROUND_LITERATURE: {
    title: "Genel Literatür",
    description:
      "Doğrudan bir yöntem veya bulgu kıyası yerine, literatür taramasında genel bağlamı desteklemek amacıyla arka plan referansı olarak kullanılabilir.",
    type: "info",
  },
};

const ACADEMIC_BADGE_STYLE: Record<
  AcademicBadge,
  { card: string; border: string; text: string }
> = {
  TWIN_THESIS_ALERT: {
    card: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
  },
  CRITICAL_REPLICATION_ALERT: {
    card: "bg-orange-500/10",
    border: "border-orange-500/20",
    text: "text-orange-400",
  },
  IRRELEVANT_DATA: {
    card: "bg-zinc-500/5",
    border: "border-zinc-500/10",
    text: "text-zinc-500",
  },
  METHODOLOGY_REFERENCE: {
    card: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    text: "text-cyan-400",
  },
  THEORETICAL_ANCHOR: {
    card: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    text: "text-indigo-400",
  },
  HISTORICAL_CONTEXT: {
    card: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
  },
  FUTURE_PROJECTION: {
    card: "bg-fuchsia-500/10",
    border: "border-fuchsia-500/20",
    text: "text-fuchsia-400",
  },
  CONTEXTUAL_COMPARISON: {
    card: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
  },
  EMPIRICAL_BENCHMARK: {
    card: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
  },
  BACKGROUND_LITERATURE: {
    card: "bg-slate-500/10",
    border: "border-slate-500/20",
    text: "text-slate-400",
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
