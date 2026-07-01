import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. GENİŞLETİLMİŞ JSON YANIT ŞEMASI
// ============================================================================

export const foundationalOracleResponseSchema: JsonSchema = {
  type: "object",
  properties: {
    selectedIndex: {
      type: "integer",
      description:
        "0-based index of the chosen work from the results array (0 for the first item, 1 for the second, etc.).",
    },
    refinedTitle: {
      type: "string",
      description:
        "Eserin arama sonuçlarında listelenen resmi, temiz ve orijinal adı. Listedeki başlığı kesinlikle değiştiremez veya uyduramazsın.",
    },
    refinedAuthor: {
      type: "string",
      description:
        "Eserin asıl kuramsal yazarı. Derleme veya editörlü eserlerdeki (eds, trans vb.) gürültüleri kendi hafızanı kullanarak temizle ve saf birincil kuramcıyı yaz.",
    },
  },
  required: ["selectedIndex", "refinedTitle", "refinedAuthor"],
};

// ============================================================================
// 2. OTONOM AKADEMİK AJAN SİSTEM TALİMATI
// ============================================================================

export function buildFoundationalOracleSystemInstruction(): string {
  return `# ROL
Sorgulanan kutu ve ana tez matrisi verilerini inceleyerek, dış dünyadaki akademik literatürü taramak üzere \`exa_academic_search\` aracını tetikleyen ve dönen sonuçlar arasından en uygun kök klasiği belirleyen otonom bir Akademik Ajan, Editör ve Epistemologsun.

# EXA ARAMA STRATEJİSİ (BEST PRACTICES)
1. \`exa_academic_search\` aracını tetiklerken üreteceğin 'query' parametresi, kaba ve kuru anahtar kelimelerden oluşmamalıdır.
2. Aradığın makalenin/kitabın kuramsal özünü, ruhunu, tarihsel konjonktürünü ve coğrafi sınırını betimleyen, uzun ve semantik olarak zengin bir AKADEMİK AÇIKLAMA PARAGRAFI inşa et. Exa bu doğal dil açıklamalarını ve "niche" kuramsal tartışmaları mükemmel yakalar.
3. Tezin veya kutunun içindeki kelimeleri körü körüne kopyalama; kavramların tarihsel dönemle olan anlamsal ilişkisini kur.

# ETKİ ALANI SINIRLAMASI (ANAKRONİZM VE LAZY LOOP YASAĞI)
1. Sana sunulan alt kutunun ve tezin tarihsel/kronolojik dönemini çok iyi analiz et. Arama sorgularında modern dönem literatürüne veya alakasız çağdaş ulus-devlet uygulamalarına kaymayı engelleyecek tarihsel token'ları otonom olarak üret.
2. Her kutuda aynı genel tarih kitaplarına veya popüler "güvenli" eserlere sığınma (Lazy loop yasağı). Eğer kutu bir CONTEXT veya PROBLEMS kutusu ise, Exa arama sorgusunu doğrudan o spesifik makro-sosyolojik veya tarihsel kırılma olgusu üzerine çapa atarak kurgula.

# GÜVENLİK VE KALİTE KURALLARI (SEÇİM AŞAMASI)
1. Arama sonuçları önüne geldiğinde, başlığında veya metadata türünde 'Review of', 'Review' veya 'Book Review' (Kitap İncelemesi) geçen kayıtları KESİNLİKLE ELE. Sadece gerçek akademik kitap, monografi veya hakemli ana makaleleri seç.
2. KRİTİK GÜVENLİK KURALI: Seçtiğin eserin yazar alanındaki editör gürültülerini temizleme yetkin vardır; ancak arama sonuçlarında listelenen orijinal eser başlığını KESİNLİKLE DEĞİŞTİREMEZSİN. Listede olmayan hayali, uydurma akademik başlıklar üretmen (halüsinasyon) kesinlikle yasaktır. \`refinedTitle\` alanı, seçtiğin eserin listedeki gerçek başlığı ile semantik olarak birebir uyumlu olmalıdır.`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================

export function buildFoundationalOracleUserPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  mainClaim: string;
  box: {
    title: string;
    boxType: string;
    description: string;
    concepts?: string[];
    semanticQuery?: string | null;
  };
}): string {
  return `[ANA TEZ MATRİSİ]
Başlık: ${params.studyTitle}
Araştırma Sorusu: ${params.researchQuestion}
Kuramsal Çerçeve: ${params.theoreticalFramework}
Metodoloji: ${params.methodology}
Araştırma Sınırları: ${params.researchScope}
Ana İddia (Main Claim): ${params.mainClaim}

[ANALİZ EDİLECEK ALT KUTU METADATASI]
Kutu Tipi: ${params.box.boxType}
Kutu Başlığı: ${params.box.title}
Açıklama: ${params.box.description}
Kavramlar: ${params.box.concepts ? params.box.concepts.join(", ") : ""}
Mevcut Semantik Kılavuz: ${params.box.semanticQuery || ""}

Adımlar:
1. Exa Best-Practices dökümantasyonuna uygun olarak, bu kutunun kuramsal ve tarihsel özünü tam odağından yakalayacak, uzun ve semantik olarak zengin bir 'exa_academic_search' sorgu paragrafı üreterek aracı tetikleyiniz.
2. Dönen ham sonuç listesinden tezin temel iddiasını ve bu kutunun bağlamını en güçlü şekilde destekleyen kök klasik eseri seçiniz ve genişletilmiş şemaya (\`selectedIndex\`, \`refinedTitle\`, \`refinedAuthor\`) uygun olarak doğrudan döndürünüz.`;
}
