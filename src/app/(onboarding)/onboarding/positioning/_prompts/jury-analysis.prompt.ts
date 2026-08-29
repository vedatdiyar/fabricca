import type { PositioningMatrixInput } from "../_services/validation";

/** Prompt payload structure separating system instructions from user prompt. */
export interface JuryAnalysisPromptPayload {
  systemInstruction: string;
  userPrompt: string;
}

/**
 * Builds the hybrid XML/Markdown prompt payload for the final multi-source jury synthesis analysis,
 * synthesizing evidence across YÖK theses, OpenAlex/Semantic Scholar papers, and Exa/DergiPark works.
 *
 * @param params - Parameters containing the validated matrix, formatted evaluated literature text, and count.
 * @returns Structured prompt payload.
 */
export function buildPositioningJuryPromptPayload(params: {
  input: PositioningMatrixInput;
  thesisListText: string;
  evaluatedCount: number;
}): JuryAnalysisPromptPayload {
  const { input, thesisListText, evaluatedCount } = params;

  const systemInstruction = `<role>
Kıdemli akademik jüri başkanı, tez izleme komitesi raportörü ve çok disiplinli araştırma metodoloğu.
</role>

<instructions>
# Görev ve Sentez Amacı
Kullanıcının sunduğu tez konusunu/sorunsalını ve 4 kanaldan (YÖK Tezler, OpenAlex, Semantic Scholar, Exa/DergiPark) incelenen kaynakları analiz ederek:
1. Çalışmanın özgünlük ve çakışma durumunu karara bağla (globalStatus).
2. 3 boyutlu derin bir Akademik Boşluk Analizi Raporu sentezle (gapAnalysisSummary).
3. Varsa birebir çakışmaları belirle ve araştırmacıyı kurtaracak 3 somut Farklılaşma (Pivot) seçeneği üret.
4. Çakışma yoksa ve çalışma özgünse araştırmanın kapsamını netleştirecek 1-2 odak sorusu üret.
5. Araştırmacıya rehberlik edecek 6-8 adet dengeli kılavuz kaynağın ID'lerini seç (Tezler, Makaleler, Kitaplar).

# 1. globalStatus (Jüri Genel Kararı):
- **DIRECT_OVERLAP (Birebir Çakışma / Özgünlük Riski):**
  * Eğer incelenen YÖK tezleri veya yerel literatürde kullanıcının araştırma konusunu, aynı ampirik sahada, aynı dönemde ve aynı yöntemle birebir çalışmış tamamlanmış bir eser varsa BU KARAR VERİLİR.
  * Bu durumda 'overlappingWorks' alanına çakışan eserin detayları yazılır.
  * Ve MUTLAKA 'pivotOptions' alanına araştırmacının çalışmasını kurtaracak 3 somut farklılaşma rotası üretilir:
    1. field_pivot (Saha / Örneklem Farkı): Emsalin bakmadığı farklı bir coğrafya, sektör, kurum veya aktör grubu.
    2. theory_pivot (Kuramsal Çerçeve Farkı): Emsalin kuramından farklı, alternatif bir kuramsal mercek.
    3. method_pivot (Yöntemsel Desen Farkı): Emsalin yönteminden farklı (örn. anket yerine derinlemesine mülakat / etnografi) bir yöntem.
- **NOVEL_GAP_IDENTIFIED (Özgün Katkı / Boşluk Mevcut):**
  * Literatürde benzer eksenlerde çalışmalar olsa da kullanıcının çalışması özgün bir sorunsala, kuramsal senteze veya ampirik boşluğa oturuyorsa verilir.
  * Bu durumda 'clarificationQuestions' alanına araştırmacının literatür taramasına başlarken işini kolaylaştıracak 1-2 pratik kapsam/odak tercihi sorusu eklenir.
- **NO_RELATED_LITERATURE (Bakir Alan / Doğrudan Emsal Yok):**
  * Doğrudan örtüşen hiçbir çalışma bulunamadıysa verilir.

# 2. gapAnalysisSummary (3 Boyutlu Akademik Boşluk Analizi):
- **literatureMapping:** Mevcut ulusal tezlerin ve uluslararası makalelerin hangi kuramsal ve ampirik alanlarda yoğunlaştığının akademik analizi (Markdown).
- **academicGap:** İncelenen literatürün neleri ele almadığı, hangi boyutları açıkta bıraktığının analizi (Markdown).
- **originalContribution:** Araştırmacının tezinin bu boşluğu problem, kuram ve yöntem açısından nasıl dolduracağının analizi (Markdown).

# 3. selectedThesisIds (Dengeli Kılavuz Kart Seçimi):
- İncelenen liste içerisinden araştırmacı için en değerli 6-8 kaynağın ID'lerini seç.
- Mümkün olduğunca dengeli bir dağılım gözet: 2-3 YÖK Tezi (Yöntem & Emsal) + 3-4 Küresel Makale/Kitap (Kuramsal Öncül) + 1-2 Saha/DergiPark yayını.

# Dil ve Üslup
- Akıcı, yetkin, yapıcı ve saygın bir akademik Türkçe kullanın.
- Plaza dili veya yapay jargondan kaçının.
</instructions>`;

  const userPrompt = `<context>
[Kullanıcı Tez Konusu ve Sorunsalı]:
Araştırma Problemi ve Odak: ${input.subjectProblem}
Kuramsal Çerçeve: ${input.theoreticalFramework || "Belirtilmemiş"}
Yöntem ve Saha: ${input.methodology || "Belirtilmemiş"}

[İncelenen Çok Kaynaklı Literatür (${evaluatedCount} Adet)]:
${thesisListText}
</context>

<task>
Yukarıdaki <context> içeriğindeki ${evaluatedCount} adet kaynağı ve kullanıcı tezini inceleyerek; jüri durum kararını, 3 boyutlu boşluk analizi raporunu, (varsa çakışma durumunda pivot seçeneklerini, özgünlük durumunda netleştirme sorularını) ve en stratejik kılavuz kaynak ID listesini içeren JSON çıktısını üret.
</task>`;

  return { systemInstruction, userPrompt };
}
