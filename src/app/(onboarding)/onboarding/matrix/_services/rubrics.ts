import type { ThesisMatrix } from "@/lib/types";

export type MatrixFieldKey = keyof ThesisMatrix;

export interface MatrixFieldStatus {
  key: MatrixFieldKey;
  label: string;
  status: "pending" | "discussing" | "completed";
  value: string;
}

export interface RubricCriteria {
  key: MatrixFieldKey;
  label: string;
  questionGuideline: string;
  minimumAcceptanceCriteria: string[];
}

/**
 * Objective FINER & academic acceptance rubrics for the 4 core matrix quadrants.
 */
export const MATRIX_RUBRICS: Record<MatrixFieldKey, RubricCriteria> = {
  subjectProblem: {
    key: "subjectProblem",
    label: "Araştırma Problemi, Aktörler ve Odak",
    questionGuideline:
      "Kullanıcının ham konusunu spesifik bir bilimsel/pratik açığa dönüştür. İlgili aktörleri, bağımlı/bağımsız değişkenleri ve araştırma probleminin sınırlarını netleştir.",
    minimumAcceptanceCriteria: [
      "Genel konu başlığından ziyade çözülmek istenen somut gerilim/boşluk tanımlanmış olmalı.",
      "İncelenen aktörler, kurumlar veya analiz birimi netleşmiş olmalı.",
      "Araştırma sorusu veya temel sınanacak önerme açıkça formüle edilmiş olmalı.",
    ],
  },
  theoreticalFramework: {
    key: "theoreticalFramework",
    label: "Teorik ve Kavramsal Çerçeve",
    questionGuideline:
      "Kullanıcının problemi hangi kuramsal mercekten, modelden veya kavramsal ekolden ele alacağını sorgula. Teorisini dikte etme; sezgisini literatürdeki kuramlarla buluştur.",
    minimumAcceptanceCriteria: [
      "Temel alınan kuram, kavramsal model veya analitik paradigma adlandırılmış olmalı.",
      "Bu kuramın araştırma problemiyle olan mantıksal bağı (neden bu kuram?) temellendirilmiş olmalı.",
    ],
  },
  primaryMaterial: {
    key: "primaryMaterial",
    label: "Veri Kaynağı / Birincil Malzeme",
    questionGuideline:
      "Kullanıcının veriyi nereden, kimlerden veya hangi arşivden toplayacağını, bu veriye erişim imkanını ve uygulanabilirliğini test et.",
    minimumAcceptanceCriteria: [
      "İncelenecek birincil malzeme, veri tabanı, arşiv, belge türü veya hedef kitle belirtilmiş olmalı.",
      "Veri erişiminin fizibilitesi (izinler, örneklem büyüklüğü hedefi) makul olmalı.",
    ],
  },
  methodology: {
    key: "methodology",
    label: "Metodoloji",
    questionGuideline:
      "Verinin nasıl toplanacağını, analiz tekniğini ve yöntemin kısıtlarını eleştir. Emsal tezlerdeki olası tuzaklara karşı kullanıcıyı uyar.",
    minimumAcceptanceCriteria: [
      "Araştırma deseni (nitel, nicel veya karma) belirlenmiş olmalı.",
      "Veri analiz tekniği (regresyon, SEM, içerik analizi, söylem analizi vb.) adlandırılmış olmalı.",
      "Yöntemin temel kısıtları veya geçerlilik-güvenilirlik önlemleri fark edilmiş olmalı.",
    ],
  },
};

/**
 * Checks which fields of the matrix are complete and returns overall readiness.
 */
export function evaluateMatrixReadiness(matrix: Partial<ThesisMatrix>): {
  completedCount: number;
  totalCount: number;
  isFullyReady: boolean;
  fields: MatrixFieldStatus[];
} {
  const keys: MatrixFieldKey[] = [
    "subjectProblem",
    "theoreticalFramework",
    "primaryMaterial",
    "methodology",
  ];

  const fields: MatrixFieldStatus[] = keys.map((key) => {
    const val = matrix[key]?.trim() ?? "";
    const clean = val.toLowerCase();
    const isPlaceholder =
      clean.includes("[bekliyor") ||
      clean.includes("[eksik") ||
      clean.includes("boş bırakıl") ||
      clean.includes("henüz mühürlen");
    const isCompleted = val.length >= 35 && !isPlaceholder;
    const isDiscussing = val.length > 0 && !isCompleted && !isPlaceholder;

    return {
      key,
      label: MATRIX_RUBRICS[key].label,
      status: isCompleted
        ? "completed"
        : isDiscussing
          ? "discussing"
          : "pending",
      value: isPlaceholder ? "" : val,
    };
  });

  const completedCount = fields.filter((f) => f.status === "completed").length;

  return {
    completedCount,
    totalCount: keys.length,
    isFullyReady: completedCount === keys.length,
    fields,
  };
}
