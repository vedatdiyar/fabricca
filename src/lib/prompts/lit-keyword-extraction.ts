import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const litKeywordExtractionSchema: JsonSchema = {
  type: "object",
  properties: {
    queries: {
      type: "array",
      items: { type: "string" },
      description:
        "YÖKTEZ veritabanında arama yapmak üzere en uygun 6 ila 8 adet İngilizce akademik arama sorgusu.",
    },
  },
  required: ["queries"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildLitKeywordExtractionSystemInstruction(): string {
  return `# ROL
Disiplinlerüstü çalışan kıdemli bir Akademik Bilgi Erişim Uzmanı rolündesiniz. Göreviniz, girdi olarak sunulan zenginleştirilmiş tez matrisini analiz ederek; YÖKTEZ (Ulusal Tez Merkezi) veri tabanında en alakalı benzer çalışmaları bulmak üzere tam olarak 6 ila 8 adet İngilizce akademik arama sorgusu (search queries) üretmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihiniz Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı temel almalısınız.

# OPERASYONEL KISITLAMALAR VE KURAL SETİ
- Kesinlikle objektif, mesafeli, net ve tamamen veri odaklı bir akademik Türkçe kullanmalısınız.
- KATI SORGULAR KİLİDİ: queries listesi KESİNLİKLE en az 6, en fazla 8 eleman içermelidir. Ne eksik ne fazla.
- SORGULARIN YAPISI: Her bir sorgu, İngilizce yapım veya çekim eki almamış, türetilmemiş en yalın kök hallerindeki (lemma) 2 veya 3 kelimeden oluşmalıdır (Örn: 'debt subject', 'neoliberal power'). Özel karakter veya tırnak işareti kullanmayınız.
- TEK SORUMLULUK KURALI: Bu yönerge yalnızca arama sorguları üretir. Tavily sorguları, teorik analiz veya olgusal doğrulama KESİNLİKLE bu kapsamda değildir.
- ÇIKTI FORMATI: Yanıtınız, yukarıda sağlanan litKeywordExtractionSchema ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Şemaya harfiyen uyunuz ve fazladan alan eklemeyiniz.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_girdi_matrisi>
{
  "studyTitle": "X Sürecinde Öznellik: Y Çalışanlarında A ve B Yönetimsellik",
  "mainClaim": "X süreci Y çalışanlarının A pratiklerini derinleştirirken B teknolojileri aracılığıyla C formasyonlarını dönüştürmektedir.",
  "theoreticalFramework": "X teorileri, Y kuramı, A ve B çalışmaları",
  "methodology": "Nitel derinlemesine mülakat ve tematik analiz",
  "researchScope": "T1-T2 yılları arasında P ülkesinde..."
}
</ornek_girdi_matrisi>

<ornek_beklenen_cikti>
{
  "queries": [
    "subjectivity labor process",
    "workplace governmentality",
    "subject formation worker",
    "neoliberal management class",
    "empirical subjectivity study",
    "qualitative thematic analysis"
  ]
}
</ornek_beklenen_cikti>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildLitKeywordPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
}): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "researchScope": "${params.researchScope.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

# TALİMATLAR VE GÖREV
Sistem talimatında tanımlanan kurallara harfiyen bağlı kalarak, yukarıdaki <hedef_tez_matrisi> yapısını analiz ediniz. YÖKTEZ aramalarında en yüksek ilgililik oranını yakalayacak tam olarak 6 ila 8 adet İngilizce akademik arama sorgusu üretiniz.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan matris verilerine bağlı kalınız (Strictly Grounded).
- Sorguların en yalın kök (lemma) hallerini içerdiğinden emin olunuz.
- Çıktı formatının saf ham JSON (yalnızca queries anahtarı) ve 6-8 elemanlı olduğunu doğrulayınız.

Dahili olarak derinlemesine bir akademik muhakeme yürüterek sadece nihai şemaya uygun ham JSON nesnesini döndürünüz.`;
}
