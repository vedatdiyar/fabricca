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
      "Ana iddiası ve araştırma odağı referans çalışma ile örtüşmemektedir.",
    type: "danger",
  },
  TWIN_THESIS_ALERT: {
    title: "İkiz Tez / Birebir Eşleşme",
    description:
      "Tüm bilimsel araştırma parametreleri referans tez ile tam uyumluluk göstermektedir.",
    type: "danger",
  },
  CRITICAL_REPLICATION_ALERT: {
    title: "Kritik Metodolojik Tekrar",
    description:
      "Temel bağlamsal unsurlar ve yöntem tasarımı referans çalışma ile çok yüksek oranda çakışmaktadır.",
    type: "warning",
  },
  INDEPENDENT_CONCEPTUAL_STUDY: {
    title: "Bağımsız Kavramsal Araştırma",
    description:
      "Araştırma tasarımı, yöntemi ve teorik kurgusu literatürden tamamen bağımsız, yüksek özgünlüğe sahip çalışma.",
    type: "success",
  },
  INNOVATIVE_EXPLORATION: {
    title: "Yenilikçi Alan Sınaması",
    description:
      "Yeni bir problematik ve yöntemin, benzer veya paralel bir hedef kitle üzerinde ilk kez sınanması.",
    type: "success",
  },
  HORIZON_EXPANSION: {
    title: "Ufuk Genişletici Araştırma",
    description:
      "Özgün bir araştırma probleminin, standart metodolojilerle tamamen farklı bir coğrafi/mekânsal bağlamda çözümlenmesi.",
    type: "success",
  },
  METHODOLOGICAL_REVOLUTION: {
    title: "Yöntemsel Paradigma Değişimi",
    description:
      "Bilinen bir problemin, literatürde daha önce o kitle için hiç denenmemiş bir yöntemle analiz edilmesi.",
    type: "success",
  },
  GEOGRAPHIC_REPRESENTATION: {
    title: "Coğrafi/Bağlamsal Temsil",
    description:
      "Benzer konu ve yöntemlerin, literatürde daha önce temsil edilmemiş tamamen yeni bir coğrafi bağlama uyarlanması.",
    type: "success",
  },
  METHOD_DRIVEN_ANALYSIS: {
    title: "Metot Odaklı Yenileme",
    description:
      "Paralel bir kitle ve konuda, araştırma yöntemini kökten değiştirerek analiz derinliği sağlayan çalışma.",
    type: "success",
  },
  THEMATIC_INITIATIVE: {
    title: "Tematik Öncü Çalışma",
    description:
      "Yepyeni bir bilimsel sorunsalın, mevcut standart yöntem ve hedef kitle sınırları içerisine başarıyla entegre edilmesi.",
    type: "success",
  },
  BALANCED_SCHOLARLY_CONTRIBUTION: {
    title: "Dengeli Akademik Katkı",
    description:
      "Mevcut literatürün ana akım parametrelerini dengeli şekilde izleyen, paralel ama bağımsız bilimsel katkı.",
    type: "info",
  },
  EMPIRICAL_ADAPTATION: {
    title: "Uygulamalı Model Adaptasyonu",
    description:
      "Rüştünü ispatlamış bir kuram ve yöntemin, literatürde çalışılmamış yeni bir temaya ve mekâna başarıyla uyarlanması.",
    type: "info",
  },
  CONTEXTUAL_MODEL_TRANSFER: {
    title: "Bağlamsal Model Transferi",
    description:
      "Yerleşik bir teorik modelin, benzer bir konunun çözümü için yepyeni bir coğrafya veya kitleye aktarılması.",
    type: "info",
  },
  CONCEPTUAL_MODEL_TRANSFER: {
    title: "Kavramsal Model Transferi",
    description:
      "Yöntem ve teoriyi değiştirmeden tutarak, aynı hedef kitle üzerinde yepyeni bir araştırma probleminin çözülmesi.",
    type: "info",
  },
  VALIDATION_STUDY: {
    title: "Doğrulayıcı Alan Çalışması",
    description:
      "Standart bir yöntem ve teorinin, paralel bir kitlede doğruluğunu test etmek amacıyla yeniden çalıştırılması.",
    type: "info",
  },
  METHODOLOGICAL_INNOVATION: {
    title: "Metodolojik Yenilikçilik",
    description:
      "Aynı araştırma problemini, yepyeni bir metodolojiyle ve tamamen farklı bir bağlamsal evrende ele alan çalışma.",
    type: "success",
  },
  METHODOLOGICAL_RECONSTRUCTION: {
    title: "Metodolojik Yeniden İnşa",
    description:
      "Aynı araştırma konusunun, benzer bağlamda fakat o konu için literatürde yeni sayılan bir yöntem tasarımıyla sınanması.",
    type: "success",
  },
  THEORETICAL_RECONSTRUCT: {
    title: "Kuramsal Yenilenme",
    description:
      "Benzer bir araştırma probleminin, tamamen bağımsız ve yeni bir teorik perspektif ile yeniden çözümlenmesi.",
    type: "success",
  },
  METHODOLOGICAL_CONTRAST: {
    title: "Metodolojik Karşıtlık",
    description:
      "İncelenen konu, kitle ve mekân aynıyken; kullanılan yöntemsel veya kuramsal lensin kökten farklılaşması.",
    type: "success",
  },
  DIALECTICAL_CONTRIBUTION: {
    title: "Diyalektik Akademik Katkı",
    description:
      "Aynı araştırma evreninde, benzer yöntemlerle tamamen bağımsız veya farklı bir hipotez/iddia geliştirilmesi.",
    type: "info",
  },
  PARADIGM_CHALLENGE: {
    title: "Paradigmatik Karşıtlık / Antitez",
    description:
      "Aynı kitle ve yöntemlerle, literatürde kabul görmüş yerleşik teze meydan okuyan zıt bulgu/antitez sunulması.",
    type: "success",
  },
  THEMATIC_EXPANSION: {
    title: "Tematik Genişleme / Yeni Odak",
    description:
      "Mevcut literatür bağlamını koruyarak, daha önce analiz edilmemiş yeni bir kurumsal aktörü veya tematik odağı inceleme.",
    type: "info",
  },
  INCREMENTAL_CLAIM_CONTRIBUTION: {
    title: "Kümülatif Bulgusal Katkı",
    description:
      "Aynı kitle ve yöntemlerle, literatürdeki mevcut bulgulara yeni ve tamamlayıcı bir ek tez sunulması.",
    type: "info",
  },
  SPATIAL_REPLICATION: {
    title: "Mekânsal Replikasyon",
    description:
      "Aynı araştırma problemini benzer yöntemlerle, sadece farklı bir mekânsal/coğrafi bağlamda tekrarlama.",
    type: "warning",
  },
  LOCAL_VALIDATION_STUDY: {
    title: "Yerel Doğrulama Çalışması",
    description:
      "Tasarım ve içerik olarak referans çalışmanın benzeri olup, sadece yerel coğrafi örneklemi farklılaştıran çalışma.",
    type: "warning",
  },
  HIGH_LITERATURE_PARALLELISM: {
    title: "Yüksek Literatür Paralelliği",
    description:
      "Konu, yöntem ve bağlamın büyük ölçüde çakıştığı, özgünlük payı oldukça sınırlı olan paralel çalışma.",
    type: "warning",
  },
  NARROW_SCOPE_REPLICATION: {
    title: "Dar Kapsamlı Replikasyon",
    description:
      "Çok dar bir bağlamsal/örneklem farkı dışında referans çalışmanın tüm araştırma patikasını tekrarlayan çalışma.",
    type: "warning",
  },
  TEMPORAL_FOLLOW_UP: {
    title: "Zamansal Takip Çalışması",
    description:
      "Araştırma tasarımı ve bağlamı aynı tutarak, sadece incelenen zaman dilimini (periyodunu) ileriye kaydıran çalışma.",
    type: "warning",
  },
  BORDERLINE_SIMILARITY_ALERT: {
    title: "Sınırda Benzerlik Değerlendirmesi",
    description:
      "Aynı kitlede, aynı konuyu benzer yöntemlerle çalışma. Kritik benzerlik sınırının hemen altında yer alır.",
    type: "warning",
  },
  TEMPORAL_UPDATE_STUDY: {
    title: "Periyodik Güncelleme Çalışması",
    description:
      "Birebir aynı kitle, yöntem ve kuramla sadece zaman diliminin güncellenmiş (yeni yıl verisi) sürümü.",
    type: "warning",
  },
};

const BADGE_TYPE_TO_CARD: Record<
  BadgeType,
  { card: string; border: string; text: string }
> = {
  danger: {
    card: "bg-destructive/10",
    border: "border-destructive/20",
    text: "text-destructive",
  },
  warning: {
    card: "bg-warning/10",
    border: "border-warning/20",
    text: "text-warning",
  },
  success: {
    card: "bg-success/10",
    border: "border-success/20",
    text: "text-success",
  },
  info: {
    card: "bg-info/10",
    border: "border-info/20",
    text: "text-info",
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
  if (meta) {
    const style = BADGE_TYPE_TO_CARD[meta.type];
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
  if (meta) {
    const style = BADGE_TYPE_TO_CARD[meta.type];
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
